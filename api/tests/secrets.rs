use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
};
use qingxin_api::{app, AppState, Config};
use serde_json::{json, Value};
use tower::ServiceExt;

async fn world() -> (axum::Router, AppState) {
    let state = AppState::connect(Config::test())
        .await
        .expect("connect test db");
    (app(state.clone()), state)
}

async fn send(
    router: &axum::Router,
    method: Method,
    uri: &str,
    auth: Option<&str>,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut builder = Request::builder().method(method).uri(uri);
    if let Some(token) = auth {
        builder = builder.header(header::AUTHORIZATION, format!("Bearer {token}"));
    }
    let request = if let Some(json) = body {
        builder
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(serde_json::to_vec(&json).unwrap()))
            .unwrap()
    } else {
        builder.body(Body::empty()).unwrap()
    };
    let response = router.clone().oneshot(request).await.unwrap();
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
        .await
        .unwrap();
    if bytes.is_empty() {
        return (status, Value::Null);
    }
    let json = serde_json::from_slice(&bytes)
        .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&bytes).into_owned()));
    (status, json)
}

fn register_body(email: &str) -> Value {
    json!({
        "email": email,
        "password": "correct-horse",
        "display_name": "轻心同学",
        "consent": { "policy_version": "2026-10-13" }
    })
}

async fn register_user(router: &axum::Router, email: &str) -> Value {
    let (status, body) = send(
        router,
        Method::POST,
        "/v1/auth/register",
        None,
        Some(register_body(email)),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    body
}

#[tokio::test]
async fn secret_requires_auth_consent_and_stays_private() {
    let (router, state) = world().await;
    let a = register_user(&router, "a-secret@qingxin.app").await;
    let b = register_user(&router, "b-secret@qingxin.app").await;
    let a_tok = a["access_token"].as_str().unwrap();
    let b_tok = b["access_token"].as_str().unwrap();

    let (status, _) = send(
        &router,
        Method::POST,
        "/v1/secrets/letters",
        None,
        Some(json!({ "body": "今天有点累。", "consent": true })),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    let (status, denied) = send(
        &router,
        Method::POST,
        "/v1/secrets/letters",
        Some(a_tok),
        Some(json!({ "body": "今天有点累。", "consent": false })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{denied}");
    assert_eq!(denied["error"]["code"], "invalid_request");

    let (status, empty) = send(
        &router,
        Method::POST,
        "/v1/secrets/letters",
        Some(a_tok),
        Some(json!({ "body": "  ", "consent": true })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{empty}");

    let (status, created) = send(
        &router,
        Method::POST,
        "/v1/secrets/letters",
        Some(a_tok),
        Some(json!({
            "title": "未署名的信",
            "body": "今天有点累。",
            "consent": true
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    assert_eq!(created["secret"]["body"], "今天有点累。");
    assert_eq!(created["secret"]["role"], "secret");
    assert_eq!(created["reply"]["role"], "reply");
    let reply = created["reply"]["body"].as_str().unwrap();
    assert!(reply.contains("此致"), "{reply}");
    assert!(reply.contains("亲爱的来信人"), "{reply}");
    assert!(!reply.contains("今天有点累。"), "{reply}");

    let secret_id = created["secret"]["id"].as_str().unwrap();
    let blob: Vec<u8> =
        sqlx::query_scalar("SELECT body_encrypted FROM secret_letters WHERE id = ?")
            .bind(secret_id)
            .fetch_one(&state.pool)
            .await
            .unwrap();
    assert!(!blob.is_empty());
    assert_ne!(blob, "今天有点累。".as_bytes());
    assert!(!blob
        .windows("今天有点累。".len())
        .any(|w| w == "今天有点累。".as_bytes()));

    let (status, listed) = send(
        &router,
        Method::GET,
        "/v1/secrets/letters",
        Some(a_tok),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{listed}");
    assert_eq!(listed["items"].as_array().unwrap().len(), 1);
    assert_eq!(listed["items"][0]["id"], created["id"]);

    let (status, other) = send(
        &router,
        Method::GET,
        "/v1/secrets/letters",
        Some(b_tok),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{other}");
    assert_eq!(other["items"].as_array().unwrap().len(), 0);

    let (status, export) = send(
        &router,
        Method::GET,
        "/v1/privacy/export",
        Some(a_tok),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{export}");
    assert_eq!(export["secret_letters"][0]["id"], created["id"]);
    assert_eq!(
        export["secret_letters"][0]["secret"]["body"],
        "今天有点累。"
    );

    let (status, _) = send(
        &router,
        Method::DELETE,
        "/v1/privacy/account",
        Some(a_tok),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let leftover: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM secret_letters")
        .fetch_one(&state.pool)
        .await
        .unwrap();
    assert_eq!(leftover, 0);
}

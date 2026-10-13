use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
};
use qingxin_api::ai::{
    AiError, AiGateway, CompletionRequest, CompletionResponse, UnconfiguredAiGateway,
};
use qingxin_api::{app, AppState, Config};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;
use tower::ServiceExt;

async fn world() -> (axum::Router, AppState) {
    let mut state = AppState::connect(Config::test())
        .await
        .expect("connect test db");
    state.ai = Arc::new(UnconfiguredAiGateway);
    (app(state.clone()), state)
}

async fn send(
    router: &axum::Router,
    method: Method,
    uri: &str,
    auth: Option<(&str, &str)>,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut builder = Request::builder().method(method).uri(uri);
    if let Some((scheme, token)) = auth {
        builder = builder.header(header::AUTHORIZATION, format!("{scheme} {token}"));
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

fn check_in(emoji: &str, tags: &[&str], note: &str) -> Value {
    json!({
        "emoji": emoji,
        "tags": tags,
        "note": note
    })
}

#[tokio::test]
async fn mood_check_in_encrypts_note_and_rejects_long_or_anonymous() {
    let (router, state) = world().await;
    let created = register_user(&router, "mood@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();

    let (status, denied) = send(
        &router,
        Method::POST,
        "/v1/mood/logs",
        None,
        Some(check_in("😔", &["睡眠"], "夜里醒了两次")),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(denied["error"]["code"], "unauthenticated");

    let (status, log) = send(
        &router,
        Method::POST,
        "/v1/mood/logs",
        Some(("Bearer", access)),
        Some(check_in("😔", &["睡眠"], "夜里醒了两次")),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{log}");
    assert_eq!(log["emoji"], "😔");
    assert_eq!(log["score"], 2);
    assert_eq!(log["tags"][0], "睡眠");
    assert_eq!(log["note"], "夜里醒了两次");
    assert!(log["id"].as_str().unwrap().len() > 8);

    let row = sqlx::query("SELECT note_encrypted FROM mood_logs WHERE id = ?")
        .bind(log["id"].as_str().unwrap())
        .fetch_one(&state.pool)
        .await
        .unwrap();
    let blob: Vec<u8> = row.get("note_encrypted");
    assert!(!blob.is_empty());
    assert_ne!(blob, "夜里醒了两次".as_bytes());

    let long = "字".repeat(100);
    let (status, body) = send(
        &router,
        Method::POST,
        "/v1/mood/logs",
        Some(("Bearer", access)),
        Some(check_in("🙂", &["工作"], &long)),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"]["code"], "invalid_request");

    let (status, empty) = send(
        &router,
        Method::POST,
        "/v1/mood/logs",
        Some(("Bearer", access)),
        Some(json!({"emoji": "🙂", "tags": []})),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{empty}");
    assert_eq!(empty["note"], Value::Null);
    let row = sqlx::query("SELECT note_encrypted FROM mood_logs WHERE id = ?")
        .bind(empty["id"].as_str().unwrap())
        .fetch_one(&state.pool)
        .await
        .unwrap();
    let blob: Option<Vec<u8>> = row.get("note_encrypted");
    assert!(blob.is_none());
}

#[tokio::test]
async fn mood_logs_are_isolated_and_tag_filtered() {
    let (router, _) = world().await;
    let a = register_user(&router, "a@qingxin.app").await;
    let b = register_user(&router, "b@qingxin.app").await;
    let a_tok = a["access_token"].as_str().unwrap();
    let b_tok = b["access_token"].as_str().unwrap();

    let (status, sleep) = send(
        &router,
        Method::POST,
        "/v1/mood/logs",
        Some(("Bearer", a_tok)),
        Some(check_in("😔", &["睡眠"], "困")),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{sleep}");
    let (status, work) = send(
        &router,
        Method::POST,
        "/v1/mood/logs",
        Some(("Bearer", a_tok)),
        Some(check_in("😡", &["工作"], "会太多")),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{work}");

    let (status, listed) = send(
        &router,
        Method::GET,
        "/v1/mood/logs?tag=%E7%9D%A1%E7%9C%A0",
        Some(("Bearer", a_tok)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{listed}");
    let items = listed["items"].as_array().unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["id"], sleep["id"]);

    let (status, other) = send(
        &router,
        Method::GET,
        "/v1/mood/logs",
        Some(("Bearer", b_tok)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{other}");
    assert!(other["items"].as_array().unwrap().is_empty());
}

#[tokio::test]
async fn mood_trends_average_and_tag_filter() {
    let (router, _) = world().await;
    let created = register_user(&router, "trend@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();

    for body in [
        check_in("😔", &["睡眠"], "a"),
        check_in("🥰", &["睡眠"], "b"),
        check_in("😡", &["工作"], "c"),
    ] {
        let (status, _) = send(
            &router,
            Method::POST,
            "/v1/mood/logs",
            Some(("Bearer", access)),
            Some(body),
        )
        .await;
        assert_eq!(status, StatusCode::CREATED);
    }

    let (status, week) = send(
        &router,
        Method::GET,
        "/v1/mood/trends?period=week",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{week}");
    let points = week["points"].as_array().unwrap();
    let today = points.iter().find(|p| p["count"] == 3).expect("today");
    assert_eq!(today["average_score"], 3.0);

    let (status, work) = send(
        &router,
        Method::GET,
        "/v1/mood/trends?period=month&tag=%E5%B7%A5%E4%BD%9C",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{work}");
    let tagged: i64 = work["points"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| p["count"].as_i64().unwrap())
        .sum();
    assert_eq!(tagged, 1);

    let (status, bad) = send(
        &router,
        Method::GET,
        "/v1/mood/trends?period=decade",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(bad["error"]["code"], "invalid_request");
}

#[tokio::test]
async fn mood_check_in_client_id_is_idempotent() {
    let (router, state) = world().await;
    let created = register_user(&router, "idempotent@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();
    let id = "11111111-1111-4111-8111-111111111111";
    let body = json!({
        "id": id,
        "emoji": "😔",
        "tags": ["睡眠"],
        "note": "夜里醒了两次"
    });

    let (status, first) = send(
        &router,
        Method::POST,
        "/v1/mood/logs",
        Some(("Bearer", access)),
        Some(body.clone()),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{first}");
    assert_eq!(first["id"], id);

    let (status, second) = send(
        &router,
        Method::POST,
        "/v1/mood/logs",
        Some(("Bearer", access)),
        Some(body),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{second}");
    assert_eq!(second["id"], id);
    assert_eq!(second["note"], "夜里醒了两次");

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM mood_logs WHERE id = ?")
        .bind(id)
        .fetch_one(&state.pool)
        .await
        .unwrap();
    assert_eq!(count, 1);
}

struct FixedGateway;

#[async_trait::async_trait]
impl AiGateway for FixedGateway {
    async fn complete(
        &self,
        _user_id: &str,
        _req: CompletionRequest,
    ) -> Result<CompletionResponse, AiError> {
        Ok(CompletionResponse {
            content: "gateway-sentence".into(),
            model: Some("fixed".into()),
            usage: None,
        })
    }
}

#[tokio::test]
async fn mood_insight_falls_back_to_deterministic_mock() {
    let (router, _) = world().await;
    let created = register_user(&router, "insight@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();

    let (status, first) = send(
        &router,
        Method::POST,
        "/v1/mood/insights",
        Some(("Bearer", access)),
        Some(json!({"emoji": "😔", "tags": ["工作", "睡眠"], "note": "累"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{first}");
    assert_eq!(first["source"], "mock");
    assert!(
        first["text"].as_str().unwrap().contains("不") || first["text"].as_str().unwrap().len() > 4
    );
    assert!(first["disclaimer"]
        .as_str()
        .unwrap()
        .contains("不构成医疗建议"));

    let (status, shuffled) = send(
        &router,
        Method::POST,
        "/v1/mood/insights",
        Some(("Bearer", access)),
        Some(json!({"emoji": "😔", "tags": ["睡眠", "工作"], "note": "累"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{shuffled}");
    assert_eq!(shuffled["text"], first["text"]);

    let (status, empty_month) = send(
        &router,
        Method::GET,
        "/v1/mood/summaries/monthly?month=2020-01",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{empty_month}");
    assert_eq!(empty_month["source"], "mock");
    assert!(!empty_month["text"].as_str().unwrap().is_empty());
}

#[tokio::test]
async fn mood_insight_uses_injected_gateway() {
    let mut state = AppState::connect(Config::test()).await.unwrap();
    state.ai = Arc::new(FixedGateway);
    let router = app(state);
    let created = register_user(&router, "gw@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();
    let (status, body) = send(
        &router,
        Method::POST,
        "/v1/mood/insights",
        Some(("Bearer", access)),
        Some(json!({"emoji": "🙂", "tags": [], "note": ""})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["source"], "gateway");
    assert_eq!(body["text"], "gateway-sentence");
}

#[tokio::test]
async fn meditation_catalog_and_sessions() {
    let (router, _) = world().await;
    let created = register_user(&router, "sit@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();

    let (status, catalog) = send(
        &router,
        Method::GET,
        "/v1/meditation/catalog",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{catalog}");
    let sounds: Vec<&str> = catalog["sounds"]
        .as_array()
        .unwrap()
        .iter()
        .map(|s| s["id"].as_str().unwrap())
        .collect();
    for id in ["rain", "waves", "fan", "fire", "white"] {
        assert!(sounds.contains(&id), "{sounds:?}");
    }
    assert!(catalog["stories"].as_array().unwrap().len() >= 2);

    let (status, session) = send(
        &router,
        Method::POST,
        "/v1/meditation/sessions",
        Some(("Bearer", access)),
        Some(json!({"kind": "breathe", "duration_sec": 76, "payload": {"cycles": 4}})),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{session}");
    assert_eq!(session["kind"], "breathe");

    let (status, bad) = send(
        &router,
        Method::POST,
        "/v1/meditation/sessions",
        Some(("Bearer", access)),
        Some(json!({"kind": "yoga", "duration_sec": 1})),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(bad["error"]["code"], "invalid_request");

    let (status, listed) = send(
        &router,
        Method::GET,
        "/v1/meditation/sessions",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{listed}");
    assert_eq!(listed["items"][0]["id"], session["id"]);
}

#[tokio::test]
async fn privacy_export_includes_mood_and_delete_cascades() {
    let (router, state) = world().await;
    let created = register_user(&router, "keep@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();

    let (status, log) = send(
        &router,
        Method::POST,
        "/v1/mood/logs",
        Some(("Bearer", access)),
        Some(check_in("😔", &["睡眠"], "夜里醒了两次")),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{log}");
    let (status, _) = send(
        &router,
        Method::POST,
        "/v1/meditation/sessions",
        Some(("Bearer", access)),
        Some(json!({"kind": "timer", "duration_sec": 60})),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);

    let (status, export) = send(
        &router,
        Method::GET,
        "/v1/privacy/export",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{export}");
    assert_eq!(export["mood_logs"][0]["note"], "夜里醒了两次");
    assert!(!export["meditation_sessions"].as_array().unwrap().is_empty());

    let (status, _) = send(
        &router,
        Method::DELETE,
        "/v1/privacy/account",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let logs: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM mood_logs")
        .fetch_one(&state.pool)
        .await
        .unwrap();
    let sits: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM meditation_sessions")
        .fetch_one(&state.pool)
        .await
        .unwrap();
    assert_eq!(logs, 0);
    assert_eq!(sits, 0);
}

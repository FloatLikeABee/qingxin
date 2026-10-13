use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
};
use qingxin_api::moderation::{Decision, Moderator, NoopModerator};
use qingxin_api::{app, scheduler, AppState, Config};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;
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

#[tokio::test]
async fn health_ok_when_database_answers() {
    let (router, _) = world().await;
    let (status, body) = send(&router, Method::GET, "/health", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["status"], "ok");
    assert_eq!(body["db"], "ok");
    assert_eq!(body["service"], "qingxin-api");
}

#[tokio::test]
async fn health_degraded_when_database_is_closed() {
    let (router, state) = world().await;
    state.pool.close().await;
    let (status, body) = send(&router, Method::GET, "/health", None, None).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(body["status"], "degraded");
}

#[tokio::test]
async fn register_login_and_me() {
    let (router, _) = world().await;
    let created = register_user(&router, "ada@qingxin.app").await;
    assert!(created["access_token"].as_str().unwrap().len() > 10);
    assert_eq!(created["token_type"], "Bearer");
    assert_eq!(created["user"]["email"], "ada@qingxin.app");

    let (status, dup) = send(
        &router,
        Method::POST,
        "/v1/auth/register",
        None,
        Some(register_body("ada@qingxin.app")),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(dup["error"]["code"], "conflict");

    let (status, bad) = send(
        &router,
        Method::POST,
        "/v1/auth/login",
        None,
        Some(json!({"email": "ada@qingxin.app", "password": "wrong-pass"})),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(bad["error"]["code"], "invalid_credentials");

    let (status, login) = send(
        &router,
        Method::POST,
        "/v1/auth/login",
        None,
        Some(json!({"email": "ada@qingxin.app", "password": "correct-horse"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let access = login["access_token"].as_str().unwrap();

    let (status, me) = send(
        &router,
        Method::GET,
        "/v1/me",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(me["email"], "ada@qingxin.app");

    let (status, denied) = send(&router, Method::GET, "/v1/me", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(denied["error"]["code"], "unauthenticated");
}

#[tokio::test]
async fn refresh_rotates_and_reuse_revokes_family() {
    let (router, _) = world().await;
    let created = register_user(&router, "refresh@qingxin.app").await;
    let first = created["refresh_token"].as_str().unwrap().to_string();

    let (status, rotated) = send(
        &router,
        Method::POST,
        "/v1/auth/refresh",
        None,
        Some(json!({"refresh_token": first})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{rotated}");
    let second = rotated["refresh_token"].as_str().unwrap().to_string();
    assert_ne!(first, second);

    let (status, replay) = send(
        &router,
        Method::POST,
        "/v1/auth/refresh",
        None,
        Some(json!({"refresh_token": first})),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(replay["error"]["code"], "unauthenticated");

    let (status, after) = send(
        &router,
        Method::POST,
        "/v1/auth/refresh",
        None,
        Some(json!({"refresh_token": second})),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(after["error"]["code"], "unauthenticated");
}

#[tokio::test]
async fn sms_stub_verifies_and_encrypts_phone() {
    let (router, state) = world().await;
    let phone = "+8613800138000";
    let (status, requested) = send(
        &router,
        Method::POST,
        "/v1/auth/sms/request",
        None,
        Some(json!({"phone": phone, "consent": {"policy_version": "2026-10-13"}})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{requested}");
    let code = requested["dev_code"]
        .as_str()
        .expect("dev_code in stub mode");

    let (status, session) = send(
        &router,
        Method::POST,
        "/v1/auth/sms/verify",
        None,
        Some(json!({
            "phone": phone,
            "code": code,
            "display_name": "阿婆",
            "consent": {"policy_version": "2026-10-13"}
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{session}");
    let access = session["access_token"].as_str().unwrap();
    assert_eq!(session["user"]["phone"], phone);

    let row = sqlx::query("SELECT phone_encrypted, phone_lookup FROM users WHERE id = ?")
        .bind(session["user"]["id"].as_str().unwrap())
        .fetch_one(&state.pool)
        .await
        .unwrap();
    let blob: Vec<u8> = row.get("phone_encrypted");
    let lookup: String = row.get("phone_lookup");
    assert!(!blob.is_empty());
    assert_ne!(blob, phone.as_bytes());
    assert_ne!(lookup, phone);

    let (status, export) = send(
        &router,
        Method::GET,
        "/v1/privacy/export",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(export["user"]["phone"], phone);
}

#[tokio::test]
async fn privacy_consent_export_and_delete() {
    let (router, _) = world().await;
    let created = register_user(&router, "privacy@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();

    let (status, consent) = send(
        &router,
        Method::GET,
        "/v1/privacy/consent",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(consent["policy_version"], "2026-10-13");

    let (status, export) = send(
        &router,
        Method::GET,
        "/v1/privacy/export",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(export["user"]["id"], created["user"]["id"]);
    assert!(export["exported_at"].as_str().is_some());

    let (status, denied) = send(&router, Method::GET, "/v1/privacy/export", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(denied["error"]["code"], "unauthenticated");

    let (status, _) = send(
        &router,
        Method::DELETE,
        "/v1/privacy/account",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let (status, login) = send(
        &router,
        Method::POST,
        "/v1/auth/login",
        None,
        Some(json!({"email": "privacy@qingxin.app", "password": "correct-horse"})),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(login["error"]["code"], "invalid_credentials");
}

#[tokio::test]
async fn ai_route_uses_mock_provider_for_authenticated_user() {
    use qingxin_api::ai::QingxinAiGateway;

    let mut state = AppState::connect(Config::test()).await.unwrap();
    state.ai = Arc::new(QingxinAiGateway::mock_rate_limited("ok-from-mock", 1));
    let router = app(state);

    let first = register_user(&router, "ai@qingxin.app").await;
    let second = register_user(&router, "ai2@qingxin.app").await;
    let access_a = first["access_token"].as_str().unwrap();
    let access_b = second["access_token"].as_str().unwrap();
    let payload = json!({"messages": [{"role": "user", "content": "hi"}]});

    let (status, body) = send(
        &router,
        Method::POST,
        "/v1/ai/complete",
        Some(("Bearer", access_a)),
        Some(payload.clone()),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["content"], "ok-from-mock");
    assert_eq!(body["model"], "mock");

    let (status, body) = send(
        &router,
        Method::POST,
        "/v1/ai/complete",
        Some(("Bearer", access_a)),
        Some(json!({"messages": [{"role": "user", "content": "second"}]})),
    )
    .await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE, "{body}");
    assert_eq!(body["error"]["code"], "unavailable");

    let (status, body) = send(
        &router,
        Method::POST,
        "/v1/ai/complete",
        Some(("Bearer", access_b)),
        Some(payload),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["content"], "ok-from-mock");
}

#[tokio::test]
async fn noop_moderator_allows_any_text_through_state() {
    let moderator = NoopModerator;
    let decision = moderator.check("obviously-not-safe").await.unwrap();
    assert_eq!(decision, Decision::Allow);

    let state = AppState::connect(Config::test()).await.unwrap();
    let via_state = state.moderator.check("").await.unwrap();
    assert_eq!(via_state, Decision::Allow);
}

#[tokio::test]
async fn caregiver_can_issue_and_revoke_device_session() {
    let (router, _) = world().await;
    let elder = register_user(&router, "elder@qingxin.app").await;
    let child = register_user(&router, "child@qingxin.app").await;
    let stranger = register_user(&router, "stranger@qingxin.app").await;
    let elder_access = elder["access_token"].as_str().unwrap();
    let child_access = child["access_token"].as_str().unwrap();
    let stranger_access = stranger["access_token"].as_str().unwrap();
    let elder_id = elder["user"]["id"].as_str().unwrap();

    let (status, invite) = send(
        &router,
        Method::POST,
        "/v1/caregiver/invites",
        Some(("Bearer", elder_access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{invite}");
    let code = invite["code"].as_str().unwrap();

    let (status, self_accept) = send(
        &router,
        Method::POST,
        "/v1/caregiver/accept",
        Some(("Bearer", elder_access)),
        Some(json!({"code": code})),
    )
    .await;
    assert!(
        status == StatusCode::BAD_REQUEST || status == StatusCode::CONFLICT,
        "{self_accept}"
    );

    let (status, link) = send(
        &router,
        Method::POST,
        "/v1/caregiver/accept",
        Some(("Bearer", child_access)),
        Some(json!({"code": code})),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{link}");
    assert_eq!(link["dependent_user_id"], elder_id);

    let (status, forbidden) = send(
        &router,
        Method::POST,
        "/v1/devices",
        Some(("Bearer", stranger_access)),
        Some(json!({"user_id": elder_id, "label": "客厅平板"})),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{forbidden}");

    let (status, device) = send(
        &router,
        Method::POST,
        "/v1/devices",
        Some(("Bearer", child_access)),
        Some(json!({"user_id": elder_id, "label": "客厅平板"})),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{device}");
    let token = device["token"].as_str().unwrap();
    let device_id = device["id"].as_str().unwrap();

    let (status, me) = send(
        &router,
        Method::GET,
        "/v1/me",
        Some(("Device", token)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{me}");
    assert_eq!(me["id"], elder_id);

    let (status, _) = send(
        &router,
        Method::DELETE,
        &format!("/v1/devices/{device_id}"),
        Some(("Bearer", child_access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let (status, denied) = send(
        &router,
        Method::GET,
        "/v1/me",
        Some(("Device", token)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(denied["error"]["code"], "unauthenticated");
}

#[tokio::test]
async fn scheduler_delivers_due_web_push_jobs() {
    let (router, state) = world().await;
    let created = register_user(&router, "jobs@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();

    let (status, sub) = send(
        &router,
        Method::POST,
        "/v1/push/subscribe",
        Some(("Bearer", access)),
        Some(json!({
            "endpoint": "https://push.example/sub",
            "keys": { "p256dh": "p256", "auth": "auth" }
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{sub}");

    let (status, vapid) = send(
        &router,
        Method::GET,
        "/v1/push/vapid-public-key",
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(vapid["public_key"].as_str().is_some());

    let (status, job) = send(
        &router,
        Method::POST,
        "/v1/jobs",
        Some(("Bearer", access)),
        Some(json!({
            "kind": "web_push",
            "run_at": "2020-01-01T00:00:00Z",
            "payload": { "title": "喝水" }
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{job}");
    assert_eq!(job["status"], "pending");

    let sent = scheduler::tick_once(&state).await.expect("tick");
    assert_eq!(sent, 1);
    assert_eq!(state.push.sent(), 1);

    let (status, listed) = send(
        &router,
        Method::GET,
        "/v1/jobs",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(listed["items"][0]["status"], "done");
}

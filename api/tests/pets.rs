use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
};
use chrono::{Duration, NaiveDate, SecondsFormat, TimeZone, Utc};
use qingxin_api::ai::UnconfiguredAiGateway;
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

async fn register(router: &axum::Router, email: &str, name: &str) -> (String, String) {
    let (status, body) = send(
        router,
        Method::POST,
        "/v1/auth/register",
        None,
        Some(json!({
            "email": email,
            "password": "correct-horse",
            "display_name": name,
            "consent": { "policy_version": "2026-10-13" }
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    (
        body["access_token"].as_str().unwrap().to_string(),
        body["user"]["id"].as_str().unwrap().to_string(),
    )
}

async fn link_pair(router: &axum::Router, elder_access: &str, caregiver_access: &str) {
    let (status, invite) = send(
        router,
        Method::POST,
        "/v1/caregiver/invites",
        Some(elder_access),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{invite}");
    let (status, link) = send(
        router,
        Method::POST,
        "/v1/caregiver/accept",
        Some(caregiver_access),
        Some(json!({ "code": invite["code"] })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{link}");
}

fn shanghai_today() -> NaiveDate {
    (Utc::now() + Duration::hours(8)).date_naive()
}

fn due_run_at(next_due: NaiveDate) -> String {
    let remind_on = next_due - Duration::days(1);
    chrono::FixedOffset::east_opt(8 * 3600)
        .unwrap()
        .from_local_datetime(&remind_on.and_hms_opt(9, 0, 0).unwrap())
        .single()
        .unwrap()
        .with_timezone(&Utc)
        .to_rfc3339_opts(SecondsFormat::Secs, true)
}

async fn create_pet(router: &axum::Router, token: &str, name: &str) -> Value {
    let (status, body) = send(
        router,
        Method::POST,
        "/v1/pets",
        Some(token),
        Some(json!({
            "name": name,
            "species": "cat",
            "breed": "狸花",
            "birthday": "2023-04-01",
            "avatar_url": "https://cdn.example/doudou.png"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    body
}

#[tokio::test]
async fn unauthenticated_pets_routes_are_401() {
    let (router, _) = world().await;
    for uri in [
        "/v1/pets",
        "/v1/pets/today",
        "/v1/pets/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ] {
        let (status, body) = send(&router, Method::GET, uri, None, None).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED, "{uri} {body}");
        assert_eq!(body["error"]["code"], "unauthenticated");
    }
}

#[tokio::test]
async fn cross_user_and_caregiver_pet_is_404() {
    let (router, _) = world().await;
    let (alice, _) = register(&router, "alice-pet@qingxin.app", "阿狸").await;
    let (bob, _) = register(&router, "bob-pet@qingxin.app", "阿豹").await;
    let (caregiver, _) = register(&router, "care-pet@qingxin.app", "家属").await;
    link_pair(&router, &alice, &caregiver).await;

    let pet = create_pet(&router, &alice, "豆豆").await;
    let pet_id = pet["id"].as_str().unwrap();

    let (status, body) = send(
        &router,
        Method::GET,
        &format!("/v1/pets/{pet_id}"),
        Some(&bob),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{body}");
    assert_eq!(body["error"]["code"], "not_found");

    let (status, body) = send(
        &router,
        Method::GET,
        &format!("/v1/pets/{pet_id}"),
        Some(&caregiver),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{body}");
    assert_eq!(body["error"]["code"], "not_found");

    let (status, body) = send(
        &router,
        Method::POST,
        &format!("/v1/pets/{pet_id}/logs"),
        Some(&bob),
        Some(json!({ "type": "feed" })),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{body}");
}

#[tokio::test]
async fn pet_crud_keeps_avatar_url() {
    let (router, _) = world().await;
    let (token, _) = register(&router, "crud-pet@qingxin.app", "饲主").await;
    let created = create_pet(&router, &token, "豆豆").await;
    assert_eq!(created["name"], "豆豆");
    assert_eq!(created["species"], "cat");
    assert_eq!(created["avatar_url"], "https://cdn.example/doudou.png");
    let pet_id = created["id"].as_str().unwrap();

    let (status, listed) = send(&router, Method::GET, "/v1/pets", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK, "{listed}");
    assert_eq!(listed["items"].as_array().unwrap().len(), 1);

    let (status, patched) = send(
        &router,
        Method::PATCH,
        &format!("/v1/pets/{pet_id}"),
        Some(&token),
        Some(json!({ "name": "豆豆仔" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{patched}");
    assert_eq!(patched["name"], "豆豆仔");

    let (status, _) = send(
        &router,
        Method::DELETE,
        &format!("/v1/pets/{pet_id}"),
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let (status, missing) = send(
        &router,
        Method::GET,
        &format!("/v1/pets/{pet_id}"),
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{missing}");
}

#[tokio::test]
async fn notes_are_encrypted_and_disclaimer_is_present() {
    let (router, state) = world().await;
    let (token, _) = register(&router, "note-pet@qingxin.app", "饲主").await;
    let pet = create_pet(&router, &token, "豆豆").await;
    let pet_id = pet["id"].as_str().unwrap();

    let (status, record) = send(
        &router,
        Method::POST,
        &format!("/v1/pets/{pet_id}/records"),
        Some(&token),
        Some(json!({
            "type": "vet_visit",
            "date": "2026-10-13",
            "note": "阿莫西林一周"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{record}");
    assert_eq!(record["note"], "阿莫西林一周");
    assert!(
        record["disclaimer"]
            .as_str()
            .unwrap_or_default()
            .contains("非兽医建议"),
        "{record}"
    );

    let row = sqlx::query("SELECT note_encrypted FROM pet_health_records WHERE id = ?")
        .bind(record["id"].as_str().unwrap())
        .fetch_one(&state.pool)
        .await
        .unwrap();
    let blob: Vec<u8> = row.get("note_encrypted");
    assert!(!blob.is_empty());
    assert_ne!(blob, "阿莫西林一周".as_bytes());

    let (status, today) = send(&router, Method::GET, "/v1/pets/today", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK, "{today}");
    assert!(
        today["disclaimer"]
            .as_str()
            .unwrap_or_default()
            .contains("非兽医建议"),
        "{today}"
    );
}

#[tokio::test]
async fn due_reminder_enqueues_and_push_fires() {
    let (router, state) = world().await;
    let (token, user_id) = register(&router, "due-pet@qingxin.app", "饲主").await;
    let pet = create_pet(&router, &token, "豆豆").await;
    let pet_id = pet["id"].as_str().unwrap();
    let next_due = shanghai_today() + Duration::days(10);

    let (status, record) = send(
        &router,
        Method::POST,
        &format!("/v1/pets/{pet_id}/records"),
        Some(&token),
        Some(json!({
            "type": "vaccine",
            "date": shanghai_today().to_string(),
            "next_due_date": next_due.to_string()
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{record}");
    let record_id = record["id"].as_str().unwrap();

    let jobs = sqlx::query(
        "SELECT id, kind, payload_json, run_at, status FROM scheduled_jobs WHERE user_id = ?",
    )
    .bind(&user_id)
    .fetch_all(&state.pool)
    .await
    .unwrap();
    let job = jobs
        .iter()
        .find(|row| row.get::<String, _>("kind") == "pet.due")
        .expect("pet.due job");
    assert_eq!(job.get::<String, _>("status"), "pending");
    assert_eq!(
        job.get::<String, _>("run_at"),
        due_run_at(next_due),
        "expected day-before 09:00 Asia/Shanghai"
    );
    let payload: Value = serde_json::from_str(&job.get::<String, _>("payload_json")).unwrap();
    assert_eq!(payload["type"], "pet.due");
    assert_eq!(payload["record_id"], record_id);

    sqlx::query("UPDATE scheduled_jobs SET run_at = '2020-01-01T00:00:00Z' WHERE user_id = ?")
        .bind(&user_id)
        .execute(&state.pool)
        .await
        .unwrap();
    let before = state.push.sent();
    let sent = scheduler::tick_once(&state).await.expect("tick");
    assert!(sent >= 1);
    assert!(state.push.sent() > before);
}

#[tokio::test]
async fn edit_and_delete_replace_due_job() {
    let (router, state) = world().await;
    let (token, user_id) = register(&router, "edit-due@qingxin.app", "饲主").await;
    let pet = create_pet(&router, &token, "豆豆").await;
    let pet_id = pet["id"].as_str().unwrap();
    let first_due = shanghai_today() + Duration::days(12);
    let second_due = shanghai_today() + Duration::days(20);

    let (status, record) = send(
        &router,
        Method::POST,
        &format!("/v1/pets/{pet_id}/records"),
        Some(&token),
        Some(json!({
            "type": "deworm",
            "date": shanghai_today().to_string(),
            "next_due_date": first_due.to_string()
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{record}");
    let record_id = record["id"].as_str().unwrap();

    let (status, patched) = send(
        &router,
        Method::PATCH,
        &format!("/v1/pets/records/{record_id}"),
        Some(&token),
        Some(json!({ "next_due_date": second_due.to_string() })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{patched}");

    let pending: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM scheduled_jobs WHERE user_id = ? AND kind = 'pet.due' AND status = 'pending'",
    )
    .bind(&user_id)
    .fetch_one(&state.pool)
    .await
    .unwrap();
    assert_eq!(pending, 1);
    let run_at: String = sqlx::query_scalar(
        "SELECT run_at FROM scheduled_jobs WHERE user_id = ? AND kind = 'pet.due' AND status = 'pending'",
    )
    .bind(&user_id)
    .fetch_one(&state.pool)
    .await
    .unwrap();
    assert_eq!(run_at, due_run_at(second_due));

    let (status, _) = send(
        &router,
        Method::DELETE,
        &format!("/v1/pets/records/{record_id}"),
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let leftover_pending: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM scheduled_jobs WHERE user_id = ? AND kind = 'pet.due' AND status = 'pending'",
    )
    .bind(&user_id)
    .fetch_one(&state.pool)
    .await
    .unwrap();
    assert_eq!(leftover_pending, 0);
}

#[tokio::test]
async fn weight_and_daily_log_update_today() {
    let (router, _) = world().await;
    let (token, _) = register(&router, "log-pet@qingxin.app", "饲主").await;
    let pet = create_pet(&router, &token, "豆豆").await;
    let pet_id = pet["id"].as_str().unwrap();

    let (status, bad) = send(
        &router,
        Method::POST,
        &format!("/v1/pets/{pet_id}/weights"),
        Some(&token),
        Some(json!({ "measured_on": "2026-10-13", "weight_g": 0 })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{bad}");

    let (status, weight) = send(
        &router,
        Method::POST,
        &format!("/v1/pets/{pet_id}/weights"),
        Some(&token),
        Some(json!({ "measured_on": "2026-10-13", "weight_g": 4200 })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{weight}");
    assert_eq!(weight["weight_g"], 4200);

    let (status, log) = send(
        &router,
        Method::POST,
        &format!("/v1/pets/{pet_id}/logs"),
        Some(&token),
        Some(json!({ "type": "feed" })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{log}");

    let (status, today) = send(&router, Method::GET, "/v1/pets/today", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK, "{today}");
    let items = today["items"].as_array().unwrap();
    let row = items
        .iter()
        .find(|item| item["pet_id"] == pet_id)
        .cloned()
        .unwrap();
    assert_eq!(row["done"]["feed"], 1);
}

#[tokio::test]
async fn care_reminders_validate_weekdays_and_enqueue() {
    let (router, state) = world().await;
    let (token, user_id) = register(&router, "care-rem@qingxin.app", "饲主").await;
    let pet = create_pet(&router, &token, "豆豆").await;
    let pet_id = pet["id"].as_str().unwrap();

    let (status, bad) = send(
        &router,
        Method::POST,
        &format!("/v1/pets/{pet_id}/reminders"),
        Some(&token),
        Some(json!({
            "kind": "feed",
            "time_local": "08:00",
            "days_of_week": []
        })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{bad}");
    assert_eq!(bad["error"]["code"], "invalid_request");

    let (status, created) = send(
        &router,
        Method::POST,
        &format!("/v1/pets/{pet_id}/reminders"),
        Some(&token),
        Some(json!({
            "kind": "feed",
            "time_local": "08:00",
            "days_of_week": [1, 2, 3, 4, 5],
            "timezone": "Asia/Shanghai"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");

    let kinds: Vec<String> =
        sqlx::query_scalar("SELECT kind FROM scheduled_jobs WHERE user_id = ?")
            .bind(&user_id)
            .fetch_all(&state.pool)
            .await
            .unwrap();
    assert!(kinds.iter().any(|kind| kind == "pet.care"), "{kinds:?}");
}

#[tokio::test]
async fn ai_care_tip_uses_unconfigured_gateway() {
    let mut state = AppState::connect(Config::test()).await.expect("connect");
    state.ai = Arc::new(UnconfiguredAiGateway);
    let router = app(state);
    let (token, _) = register(&router, "ai-pet@qingxin.app", "饲主").await;
    let pet = create_pet(&router, &token, "豆豆").await;
    let (status, body) = send(
        &router,
        Method::POST,
        "/v1/pets/ai/care-tip",
        Some(&token),
        Some(json!({ "pet_id": pet["id"], "topic": "疫苗" })),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_IMPLEMENTED, "{body}");
    assert_eq!(body["error"]["code"], "ai_unconfigured");
}

#[tokio::test]
async fn privacy_export_and_delete_cover_pets() {
    let (router, state) = world().await;
    let (token, user_id) = register(&router, "vault-pet@qingxin.app", "饲主").await;
    let pet = create_pet(&router, &token, "豆豆").await;
    let pet_id = pet["id"].as_str().unwrap();
    let (status, record) = send(
        &router,
        Method::POST,
        &format!("/v1/pets/{pet_id}/records"),
        Some(&token),
        Some(json!({
            "type": "vet_visit",
            "date": "2026-10-13",
            "note": "阿莫西林一周"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{record}");

    let (status, export) = send(
        &router,
        Method::GET,
        "/v1/privacy/export",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{export}");
    assert_eq!(export["pets"]["pets"][0]["name"], "豆豆");
    assert_eq!(export["pets"]["records"][0]["note"], "阿莫西林一周");

    let (status, _) = send(
        &router,
        Method::DELETE,
        "/v1/privacy/account",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    for table in [
        "pet_pets",
        "pet_health_records",
        "pet_weights",
        "pet_daily_logs",
        "pet_reminders",
    ] {
        let leftover: i64 =
            sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table} WHERE user_id = ?"))
                .bind(&user_id)
                .fetch_one(&state.pool)
                .await
                .unwrap();
        assert_eq!(leftover, 0, "{table}");
    }
}

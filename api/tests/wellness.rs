use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
};
use qingxin_api::ai::{QingxinAiGateway, UnconfiguredAiGateway};
use qingxin_api::{app, scheduler, AppState, Config};
use serde_json::{json, Value};
use std::sync::Arc;
use tower::ServiceExt;

async fn world() -> (axum::Router, AppState) {
    let state = AppState::connect(Config::test())
        .await
        .expect("connect test db");
    (app(state.clone()), state)
}

async fn world_ai(text: &str) -> (axum::Router, AppState) {
    let mut state = AppState::connect(Config::test())
        .await
        .expect("connect test db");
    state.ai = Arc::new(QingxinAiGateway::mock(text));
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

async fn register(router: &axum::Router, email: &str) -> (String, String) {
    let (status, body) = send(
        router,
        Method::POST,
        "/v1/auth/register",
        None,
        Some(json!({
            "email": email,
            "password": "correct-horse",
            "display_name": "养生同学",
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
    let code = invite["code"].as_str().unwrap();
    let (status, link) = send(
        router,
        Method::POST,
        "/v1/caregiver/accept",
        Some(caregiver_access),
        Some(json!({ "code": code })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{link}");
}

#[tokio::test]
async fn wellness_requires_auth() {
    let (router, _) = world().await;
    let (status, body) = send(&router, Method::GET, "/v1/wellness/today", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"]["code"], "unauthenticated");
}

#[tokio::test]
async fn water_progress_defaults_and_rejects_bad_ml() {
    let (router, _) = world().await;
    let (token, _) = register(&router, "water@qingxin.app").await;

    let (status, bad) = send(
        &router,
        Method::POST,
        "/v1/wellness/water",
        Some(&token),
        Some(json!({ "ml": 0 })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{bad}");
    assert_eq!(bad["error"]["code"], "invalid_request");

    for _ in 0..4 {
        let (status, sip) = send(
            &router,
            Method::POST,
            "/v1/wellness/water",
            Some(&token),
            Some(json!({ "ml": 250 })),
        )
        .await;
        assert_eq!(status, StatusCode::CREATED, "{sip}");
    }

    let (status, today) = send(
        &router,
        Method::GET,
        "/v1/wellness/today",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{today}");
    assert_eq!(
        today["disclaimer"],
        "本模块为生活习惯记录工具，不构成医疗建议。身体不适请及时就医。"
    );
    assert_eq!(today["water"]["total_ml"], 1000);
    assert_eq!(today["water"]["target_ml"], 2000);
}

#[tokio::test]
async fn cross_user_and_caregiver_water_is_404() {
    let (router, _) = world().await;
    let (alice, _) = register(&router, "alice-well@qingxin.app").await;
    let (bob, _) = register(&router, "bob-well@qingxin.app").await;
    let (care, _) = register(&router, "care-well@qingxin.app").await;
    link_pair(&router, &alice, &care).await;

    let (status, created) = send(
        &router,
        Method::POST,
        "/v1/wellness/water",
        Some(&alice),
        Some(json!({ "ml": 250 })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    let id = created["id"].as_str().unwrap();

    let (status, body) = send(
        &router,
        Method::GET,
        &format!("/v1/wellness/water/{id}"),
        Some(&bob),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{body}");

    let (status, body) = send(
        &router,
        Method::DELETE,
        &format!("/v1/wellness/water/{id}"),
        Some(&care),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{body}");

    let (status, today) = send(
        &router,
        Method::GET,
        "/v1/wellness/today",
        Some(&care),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{today}");
    assert_eq!(today["water"]["total_ml"], 0);
}

#[tokio::test]
async fn default_water_reminders_expand_and_interval_is_inclusive() {
    let (router, state) = world().await;
    let (token, _) = register(&router, "remind@qingxin.app").await;

    let (status, today) = send(
        &router,
        Method::GET,
        "/v1/wellness/today",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{today}");

    let (status, listed) = send(
        &router,
        Method::GET,
        "/v1/wellness/reminders",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{listed}");
    let times: Vec<&str> = listed["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|row| row["time"].as_str().unwrap())
        .collect();
    assert_eq!(
        times,
        vec!["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"]
    );

    let (status, replaced) = send(
        &router,
        Method::POST,
        "/v1/wellness/reminders",
        Some(&token),
        Some(json!({
            "kind": "water",
            "interval_hours": 2,
            "window_start": "09:00",
            "window_end": "13:00",
            "days_of_week": [1, 2, 3, 4, 5]
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{replaced}");
    let new_times: Vec<&str> = replaced["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|row| row["time"].as_str().unwrap())
        .collect();
    assert_eq!(new_times, vec!["09:00", "11:00", "13:00"]);

    let (status, jobs) = send(&router, Method::GET, "/v1/jobs", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK, "{jobs}");
    let job = jobs["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| row["payload"]["type"] == "wellness.water" && row["status"] == "pending")
        .cloned()
        .expect("water job");
    assert_eq!(job["kind"], "web_push");

    sqlx::query("UPDATE scheduled_jobs SET run_at = ? WHERE id = ?")
        .bind("2020-01-01T00:00:00Z")
        .bind(job["id"].as_str().unwrap())
        .execute(&state.pool)
        .await
        .unwrap();
    let sent_before = state.push.sent();
    let sent = scheduler::tick_once(&state).await.expect("tick");
    assert!(sent >= 1);
    assert!(state.push.sent() > sent_before);
}

#[tokio::test]
async fn cycle_consent_gates_storage_and_prediction() {
    let (router, state) = world().await;
    let (token, user_id) = register(&router, "cycle@qingxin.app").await;

    let (status, blocked) = send(
        &router,
        Method::POST,
        "/v1/wellness/cycles",
        Some(&token),
        Some(json!({ "start_date": "2026-08-01", "symptoms": "痛经" })),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{blocked}");
    let leftover: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM well_cycles WHERE user_id = ?")
        .bind(&user_id)
        .fetch_one(&state.pool)
        .await
        .unwrap();
    assert_eq!(leftover, 0);

    let (status, on) = send(
        &router,
        Method::PUT,
        "/v1/wellness/consent",
        Some(&token),
        Some(json!({ "cycle_consent": true })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{on}");
    assert_eq!(on["cycle_consent"], true);

    let (status, first) = send(
        &router,
        Method::POST,
        "/v1/wellness/cycles",
        Some(&token),
        Some(json!({ "start_date": "2026-08-01", "symptoms": "痛经" })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{first}");
    assert_eq!(first["symptoms"], "痛经");

    let blob: Vec<u8> =
        sqlx::query_scalar("SELECT symptoms_encrypted FROM well_cycles WHERE id = ?")
            .bind(first["id"].as_str().unwrap())
            .fetch_one(&state.pool)
            .await
            .unwrap();
    assert!(!blob.is_empty());
    assert_ne!(blob, "痛经".as_bytes());

    let (status, second) = send(
        &router,
        Method::POST,
        "/v1/wellness/cycles",
        Some(&token),
        Some(json!({ "start_date": "2026-08-29" })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{second}");

    let (status, prediction) = send(
        &router,
        Method::GET,
        "/v1/wellness/cycles/prediction",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{prediction}");
    assert_eq!(prediction["average_length_days"], 28);
    assert_eq!(prediction["next_start"], "2026-09-26");
    assert_eq!(prediction["label"], "仅供参考");
    assert!(prediction["disclaimer"]
        .as_str()
        .unwrap()
        .contains("不构成医疗建议"));

    let (status, off) = send(
        &router,
        Method::PUT,
        "/v1/wellness/consent",
        Some(&token),
        Some(json!({ "cycle_consent": false })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{off}");
    let leftover: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM well_cycles WHERE user_id = ?")
        .bind(&user_id)
        .fetch_one(&state.pool)
        .await
        .unwrap();
    assert_eq!(leftover, 0);
}

#[tokio::test]
async fn sleep_note_and_report_metrics_are_encrypted() {
    let (router, state) = world().await;
    let (token, _) = register(&router, "vault-well@qingxin.app").await;

    let (status, sleep) = send(
        &router,
        Method::POST,
        "/v1/wellness/sleep",
        Some(&token),
        Some(json!({
            "sleep_at": "2026-10-12T14:30:00Z",
            "wake_at": "2026-10-12T22:30:00Z",
            "quality": 4,
            "note": "夜里醒了"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{sleep}");
    assert_eq!(sleep["note"], "夜里醒了");
    let blob: Vec<u8> =
        sqlx::query_scalar("SELECT note_encrypted FROM well_sleep_logs WHERE id = ?")
            .bind(sleep["id"].as_str().unwrap())
            .fetch_one(&state.pool)
            .await
            .unwrap();
    assert!(!blob.is_empty());
    assert_ne!(blob, "夜里醒了".as_bytes());

    let (status, report) = send(
        &router,
        Method::POST,
        "/v1/wellness/reports",
        Some(&token),
        Some(json!({
            "title": "体检",
            "report_date": "2026-10-01",
            "metrics": [{ "name": "血压", "value": "120/80", "unit": "mmHg" }]
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{report}");
    assert_eq!(report["metrics"][0]["name"], "血压");
    assert_eq!(report["source"], "manual");
    assert_eq!(report["confirmed"], true);
    let metrics_blob: Vec<u8> =
        sqlx::query_scalar("SELECT metrics_encrypted FROM well_reports WHERE id = ?")
            .bind(report["id"].as_str().unwrap())
            .fetch_one(&state.pool)
            .await
            .unwrap();
    assert!(!metrics_blob.is_empty());
    assert!(!String::from_utf8_lossy(&metrics_blob).contains("血压"));

    let (status, rejected) = send(
        &router,
        Method::POST,
        "/v1/wellness/reports",
        Some(&token),
        Some(json!({
            "title": "扫描件",
            "report_date": "2026-10-01",
            "file_url": "https://example.com/a.pdf",
            "metrics": []
        })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{rejected}");
}

#[tokio::test]
async fn ocr_uses_ai_gateway_and_unconfigured_is_501() {
    let (router, _) = world_ai(r#"[{"name":"血压","value":"120/80","unit":"mmHg"}]"#).await;
    let (token, _) = register(&router, "ocr@qingxin.app").await;
    let (status, ocr) = send(
        &router,
        Method::POST,
        "/v1/wellness/reports/ocr",
        Some(&token),
        Some(json!({ "text": "血压 120/80" })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{ocr}");
    assert_eq!(ocr["source"], "ai_stub");
    assert_eq!(ocr["confirmed"], false);
    assert_eq!(ocr["metrics"][0]["name"], "血压");
    assert!(ocr["disclaimer"]
        .as_str()
        .unwrap()
        .contains("不构成医疗建议"));

    let mut state = AppState::connect(Config::test())
        .await
        .expect("connect test db");
    state.ai = Arc::new(UnconfiguredAiGateway);
    let router = app(state.clone());
    let (token, _) = register(&router, "ocr-off@qingxin.app").await;
    let (status, body) = send(
        &router,
        Method::POST,
        "/v1/wellness/reports/ocr",
        Some(&token),
        Some(json!({ "text": "血糖 5.2" })),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_IMPLEMENTED, "{body}");
    assert_eq!(body["error"]["code"], "ai_unconfigured");
}

#[tokio::test]
async fn plan_checkin_is_idempotent() {
    let (router, _) = world().await;
    let (token, _) = register(&router, "plan@qingxin.app").await;
    let (status, created) = send(
        &router,
        Method::POST,
        "/v1/wellness/plans",
        Some(&token),
        Some(json!({ "kind": "water_21" })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    assert_eq!(created["target_days"], 21);
    let id = created["id"].as_str().unwrap();

    let day = json!({ "day": "2026-10-13" });
    let (status, first) = send(
        &router,
        Method::POST,
        &format!("/v1/wellness/plans/{id}/checkins"),
        Some(&token),
        Some(day.clone()),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{first}");
    let (status, again) = send(
        &router,
        Method::POST,
        &format!("/v1/wellness/plans/{id}/checkins"),
        Some(&token),
        Some(day),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{again}");
    assert_eq!(again["id"], first["id"]);

    let (status, listed) = send(
        &router,
        Method::GET,
        "/v1/wellness/plans",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{listed}");
    assert_eq!(listed["items"][0]["progress_days"], 1);
}

#[tokio::test]
async fn privacy_hooks_cover_wellness() {
    let (router, state) = world().await;
    let (token, user_id) = register(&router, "export-well@qingxin.app").await;

    let (status, _) = send(
        &router,
        Method::POST,
        "/v1/wellness/water",
        Some(&token),
        Some(json!({ "ml": 250 })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let (status, sleep) = send(
        &router,
        Method::POST,
        "/v1/wellness/sleep",
        Some(&token),
        Some(json!({
            "sleep_at": "2026-10-12T14:30:00Z",
            "wake_at": "2026-10-12T22:30:00Z",
            "quality": 3,
            "note": "夜里醒了"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{sleep}");

    let (status, export) = send(
        &router,
        Method::GET,
        "/v1/privacy/export",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{export}");
    assert_eq!(export["wellness"]["water_logs"][0]["ml"], 250);
    assert_eq!(export["wellness"]["sleep_logs"][0]["note"], "夜里醒了");
    assert_eq!(export["wellness"]["cycle_consent"], false);
    assert_eq!(export["wellness"]["cycles"].as_array().unwrap().len(), 0);

    let (status, _) = send(
        &router,
        Method::DELETE,
        "/v1/privacy/account",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let leftover: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM well_water_logs WHERE user_id = ?")
            .bind(&user_id)
            .fetch_one(&state.pool)
            .await
            .unwrap();
    assert_eq!(leftover, 0);
}

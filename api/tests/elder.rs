use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
};
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

fn register_body(email: &str, name: &str) -> Value {
    json!({
        "email": email,
        "password": "correct-horse",
        "display_name": name,
        "consent": { "policy_version": "2026-10-13" }
    })
}

async fn register_user(router: &axum::Router, email: &str, name: &str) -> Value {
    let (status, body) = send(
        router,
        Method::POST,
        "/v1/auth/register",
        None,
        Some(register_body(email, name)),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    body
}

async fn link_pair(router: &axum::Router, elder_access: &str, caregiver_access: &str) -> Value {
    let (status, invite) = send(
        router,
        Method::POST,
        "/v1/caregiver/invites",
        Some(("Bearer", elder_access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{invite}");
    let code = invite["code"].as_str().unwrap();
    let (status, link) = send(
        router,
        Method::POST,
        "/v1/caregiver/accept",
        Some(("Bearer", caregiver_access)),
        Some(json!({ "code": code })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{link}");
    link
}

fn reminder_body() -> Value {
    json!({
        "title": "降压药",
        "body": "早餐后一粒",
        "kind": "medication",
        "time": "08:00",
        "days_of_week": [1, 2, 3, 4, 5],
        "timezone": "Asia/Shanghai",
        "voice_text": "该吃降压药了"
    })
}

#[tokio::test]
async fn unauthenticated_elder_routes_are_401() {
    let (router, _) = world().await;
    let (status, body) = send(&router, Method::GET, "/v1/elder/today", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED, "{body}");
    assert_eq!(body["error"]["code"], "unauthenticated");

    let (status, body) = send(&router, Method::GET, "/v1/elder/me/reminders", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED, "{body}");
    assert_eq!(body["error"]["code"], "unauthenticated");
}

#[tokio::test]
async fn elder_invite_path_is_not_added() {
    let (router, _) = world().await;
    let elder = register_user(&router, "noinvite@qingxin.app", "老人").await;
    let access = elder["access_token"].as_str().unwrap();
    let (status, _) = send(
        &router,
        Method::POST,
        "/v1/elder/links/invite",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn stranger_and_revoked_caregiver_get_404() {
    let (router, _) = world().await;
    let elder = register_user(&router, "bound@qingxin.app", "老人").await;
    let child = register_user(&router, "child-m3@qingxin.app", "子女").await;
    let stranger = register_user(&router, "stranger-m3@qingxin.app", "路人").await;
    let elder_access = elder["access_token"].as_str().unwrap();
    let child_access = child["access_token"].as_str().unwrap();
    let stranger_access = stranger["access_token"].as_str().unwrap();
    let elder_id = elder["user"]["id"].as_str().unwrap();

    let link = link_pair(&router, elder_access, child_access).await;
    let link_id = link["id"].as_str().unwrap();

    let (status, created) = send(
        &router,
        Method::POST,
        &format!("/v1/elder/{elder_id}/reminders"),
        Some(("Bearer", child_access)),
        Some(reminder_body()),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    assert_eq!(created["created_by_user_id"], child["user"]["id"]);
    assert_eq!(created["time"], "08:00");
    assert_eq!(created["days_of_week"], json!([1, 2, 3, 4, 5]));

    let (status, hidden) = send(
        &router,
        Method::GET,
        &format!("/v1/elder/{elder_id}/reminders"),
        Some(("Bearer", stranger_access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{hidden}");
    assert_eq!(hidden["error"]["code"], "not_found");

    let (status, _) = send(
        &router,
        Method::DELETE,
        &format!("/v1/caregiver/links/{link_id}"),
        Some(("Bearer", elder_access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let (status, after) = send(
        &router,
        Method::GET,
        &format!("/v1/elder/{elder_id}/reminders"),
        Some(("Bearer", child_access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{after}");
}

#[tokio::test]
async fn device_session_reads_today_as_elder() {
    let (router, _) = world().await;
    let elder = register_user(&router, "tablet@qingxin.app", "老人").await;
    let child = register_user(&router, "issuer@qingxin.app", "子女").await;
    let elder_access = elder["access_token"].as_str().unwrap();
    let child_access = child["access_token"].as_str().unwrap();
    let elder_id = elder["user"]["id"].as_str().unwrap();
    link_pair(&router, elder_access, child_access).await;

    let (status, device) = send(
        &router,
        Method::POST,
        "/v1/devices",
        Some(("Bearer", child_access)),
        Some(json!({ "user_id": elder_id, "label": "客厅平板" })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{device}");
    let token = device["token"].as_str().unwrap();

    let (status, today) = send(
        &router,
        Method::GET,
        "/v1/elder/today",
        Some(("Device", token)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{today}");
    assert_eq!(today["elder_user_id"], elder_id);
    let disclaimer = today["disclaimer"].as_str().unwrap();
    assert!(
        disclaimer.contains("闹钟")
            || disclaimer.contains("不可靠")
            || disclaimer.contains("不能替代"),
        "{disclaimer}"
    );
}

#[tokio::test]
async fn cron_schedule_is_rejected() {
    let (router, _) = world().await;
    let elder = register_user(&router, "cron@qingxin.app", "老人").await;
    let access = elder["access_token"].as_str().unwrap();
    let elder_id = elder["user"]["id"].as_str().unwrap();
    let (status, body) = send(
        &router,
        Method::POST,
        &format!("/v1/elder/{elder_id}/reminders"),
        Some(("Bearer", access)),
        Some(json!({
            "title": "药",
            "body": "一粒",
            "kind": "medication",
            "schedule_cron": "0 8 * * *",
            "timezone": "Asia/Shanghai"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    assert_eq!(body["error"]["code"], "invalid_request");
}

#[tokio::test]
async fn ack_is_idempotent_per_occurrence() {
    let (router, state) = world().await;
    let elder = register_user(&router, "ack@qingxin.app", "老人").await;
    let access = elder["access_token"].as_str().unwrap();
    let elder_id = elder["user"]["id"].as_str().unwrap().to_string();
    let (status, reminder) = send(
        &router,
        Method::POST,
        &format!("/v1/elder/{elder_id}/reminders"),
        Some(("Bearer", access)),
        Some(reminder_body()),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{reminder}");
    let reminder_id = reminder["id"].as_str().unwrap();
    let occurrence = "2026-10-13T00:00:00Z";

    let (status, first) = send(
        &router,
        Method::POST,
        &format!("/v1/elder/{elder_id}/reminders/{reminder_id}/ack"),
        Some(("Bearer", access)),
        Some(json!({ "occurrence_at": occurrence })),
    )
    .await;
    assert!(status.is_success(), "{first}");

    let (status, second) = send(
        &router,
        Method::POST,
        &format!("/v1/elder/{elder_id}/reminders/{reminder_id}/ack"),
        Some(("Bearer", access)),
        Some(json!({ "occurrence_at": occurrence })),
    )
    .await;
    assert!(status.is_success(), "{second}");

    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM elder_reminder_events
         WHERE reminder_id = ? AND occurrence_at = ? AND status = 'acked'",
    )
    .bind(reminder_id)
    .bind(occurrence)
    .fetch_one(&state.pool)
    .await
    .unwrap();
    assert_eq!(count, 1);
}

#[tokio::test]
async fn scheduler_pushes_reminder_and_miss_notifies_caregiver() {
    let (router, state) = world().await;
    let elder = register_user(&router, "miss@qingxin.app", "老人").await;
    let child = register_user(&router, "miss-child@qingxin.app", "子女").await;
    let elder_access = elder["access_token"].as_str().unwrap();
    let child_access = child["access_token"].as_str().unwrap();
    let elder_id = elder["user"]["id"].as_str().unwrap();
    link_pair(&router, elder_access, child_access).await;

    let (status, reminder) = send(
        &router,
        Method::POST,
        &format!("/v1/elder/{elder_id}/reminders"),
        Some(("Bearer", elder_access)),
        Some(reminder_body()),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{reminder}");
    let reminder_id = reminder["id"].as_str().unwrap();

    let jobs = sqlx::query("SELECT id, payload_json, status FROM scheduled_jobs WHERE user_id = ?")
        .bind(elder_id)
        .fetch_all(&state.pool)
        .await
        .unwrap();
    assert!(
        jobs.len() >= 2,
        "expected reminder + miss-check jobs, got {}",
        jobs.len()
    );

    sqlx::query("UPDATE scheduled_jobs SET run_at = '2020-01-01T00:00:00Z' WHERE user_id = ?")
        .bind(elder_id)
        .execute(&state.pool)
        .await
        .unwrap();

    let sent = scheduler::tick_once(&state).await.expect("tick");
    assert!(sent >= 1, "sent={sent}");
    assert!(state.push.sent() >= 1);

    let payloads: Vec<String> = jobs
        .iter()
        .map(|row| row.get::<String, _>("payload_json"))
        .collect();
    assert!(
        payloads.iter().any(|p| p.contains("elder_reminder")),
        "{payloads:?}"
    );

    let (status, notices) = send(
        &router,
        Method::GET,
        "/v1/elder/notices",
        Some(("Bearer", child_access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{notices}");
    assert!(
        notices["items"]
            .as_array()
            .unwrap()
            .iter()
            .any(|n| n["kind"] == "missed_dose"),
        "{notices}"
    );

    let (status, sms) = send(
        &router,
        Method::GET,
        &format!("/v1/elder/{elder_id}/sms-log"),
        Some(("Bearer", child_access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{sms}");
    assert!(
        sms["items"]
            .as_array()
            .unwrap()
            .iter()
            .any(|row| row["purpose"] == "missed_dose"),
        "{sms}"
    );
    let _ = reminder_id;
}

#[tokio::test]
async fn acked_occurrence_is_not_marked_missed() {
    let (router, state) = world().await;
    let elder = register_user(&router, "safe@qingxin.app", "老人").await;
    let child = register_user(&router, "safe-child@qingxin.app", "子女").await;
    let elder_access = elder["access_token"].as_str().unwrap();
    let child_access = child["access_token"].as_str().unwrap();
    let elder_id = elder["user"]["id"].as_str().unwrap();
    link_pair(&router, elder_access, child_access).await;

    let (status, reminder) = send(
        &router,
        Method::POST,
        &format!("/v1/elder/{elder_id}/reminders"),
        Some(("Bearer", elder_access)),
        Some(reminder_body()),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{reminder}");
    let reminder_id = reminder["id"].as_str().unwrap();

    let rows = sqlx::query("SELECT payload_json FROM scheduled_jobs WHERE user_id = ?")
        .bind(elder_id)
        .fetch_all(&state.pool)
        .await
        .unwrap();
    let mut occurrence = None;
    for row in &rows {
        let payload: Value = serde_json::from_str(&row.get::<String, _>("payload_json")).unwrap();
        if payload["type"] == "elder_miss_check" {
            occurrence = payload["occurrence_at"].as_str().map(ToOwned::to_owned);
        }
    }
    let occurrence = occurrence.expect("miss-check job");

    let (status, ack) = send(
        &router,
        Method::POST,
        &format!("/v1/elder/{elder_id}/reminders/{reminder_id}/ack"),
        Some(("Bearer", elder_access)),
        Some(json!({ "occurrence_at": occurrence })),
    )
    .await;
    assert!(status.is_success(), "{ack}");

    sqlx::query("UPDATE scheduled_jobs SET run_at = '2020-01-01T00:00:00Z' WHERE user_id = ?")
        .bind(elder_id)
        .execute(&state.pool)
        .await
        .unwrap();
    let _ = scheduler::tick_once(&state).await.unwrap();

    let (status, notices) = send(
        &router,
        Method::GET,
        "/v1/elder/notices",
        Some(("Bearer", child_access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{notices}");
    let missed = notices["items"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|n| n["kind"] == "missed_dose")
        .count();
    assert_eq!(missed, 0, "{notices}");
}

#[tokio::test]
async fn contacts_are_encrypted_and_include_emergency_numbers() {
    let (router, state) = world().await;
    let elder = register_user(&router, "phone@qingxin.app", "老人").await;
    let access = elder["access_token"].as_str().unwrap();
    let elder_id = elder["user"]["id"].as_str().unwrap();
    let phone = "+8613800138001";

    let (status, created) = send(
        &router,
        Method::POST,
        &format!("/v1/elder/{elder_id}/contacts"),
        Some(("Bearer", access)),
        Some(json!({
            "name": "女儿",
            "relation": "子女",
            "phone": phone
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    assert_eq!(created["phone"], phone);

    let blob: Vec<u8> =
        sqlx::query_scalar("SELECT phone_encrypted FROM elder_contacts WHERE id = ?")
            .bind(created["id"].as_str().unwrap())
            .fetch_one(&state.pool)
            .await
            .unwrap();
    assert_ne!(blob, phone.as_bytes());
    assert!(!String::from_utf8_lossy(&blob).contains(phone));

    let (status, listed) = send(
        &router,
        Method::GET,
        &format!("/v1/elder/{elder_id}/contacts"),
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{listed}");
    let numbers: Vec<String> = listed["items"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|c| c["phone"].as_str().map(ToOwned::to_owned))
        .collect();
    assert!(numbers.contains(&"120".into()), "{listed}");
    assert!(numbers.contains(&"110".into()), "{listed}");
}

#[tokio::test]
async fn system_tutorials_are_seeded_and_family_ones_are_private() {
    let (router, _) = world().await;
    let elder = register_user(&router, "guide@qingxin.app", "老人").await;
    let stranger = register_user(&router, "guide-x@qingxin.app", "路人").await;
    let access = elder["access_token"].as_str().unwrap();
    let stranger_access = stranger["access_token"].as_str().unwrap();
    let elder_id = elder["user"]["id"].as_str().unwrap();

    let (status, system) = send(
        &router,
        Method::GET,
        "/v1/elder/tutorials/system",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{system}");
    let titles: Vec<&str> = system["items"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|t| t["title"].as_str())
        .collect();
    assert!(titles.iter().any(|t| t.contains("医院挂号")), "{system}");
    assert!(titles.iter().any(|t| t.contains("社保认证")), "{system}");
    assert!(
        titles
            .iter()
            .any(|t| t.contains("健康码") || t.contains("扫码")),
        "{system}"
    );

    let (status, created) = send(
        &router,
        Method::POST,
        &format!("/v1/elder/{elder_id}/tutorials"),
        Some(("Bearer", access)),
        Some(json!({
            "title": "家里WiFi",
            "steps": [{ "text": "打开路由器" }]
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");

    let (status, hidden) = send(
        &router,
        Method::GET,
        &format!("/v1/elder/{elder_id}/tutorials"),
        Some(("Bearer", stranger_access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{hidden}");
}

#[tokio::test]
async fn fraud_scripts_cite_sources_and_flags_are_hashed() {
    let (router, state) = world().await;
    let elder = register_user(&router, "fraud@qingxin.app", "老人").await;
    let other = register_user(&router, "fraud2@qingxin.app", "邻居").await;
    let access = elder["access_token"].as_str().unwrap();
    let other_access = other["access_token"].as_str().unwrap();

    let (status, scripts) = send(
        &router,
        Method::GET,
        "/v1/elder/fraud-scripts",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{scripts}");
    let items = scripts["items"].as_array().unwrap();
    assert!(!items.is_empty());
    for item in items {
        assert!(!item["source_name"].as_str().unwrap().is_empty(), "{item}");
        assert!(
            item["source_url"].as_str().unwrap().starts_with("http"),
            "{item}"
        );
    }

    let script_id = items[0]["id"].as_str().unwrap();
    let (status, denied) = send(
        &router,
        Method::PATCH,
        &format!("/v1/elder/fraud-scripts/{script_id}"),
        Some(("Bearer", access)),
        Some(json!({ "title": "篡改" })),
    )
    .await;
    assert!(
        status == StatusCode::FORBIDDEN || status == StatusCode::NOT_FOUND,
        "{denied}"
    );

    let phone = "+8613990000001";
    let (status, flagged) = send(
        &router,
        Method::POST,
        "/v1/elder/number-flags",
        Some(("Bearer", access)),
        Some(json!({ "phone": phone })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{flagged}");

    let stored: String = sqlx::query_scalar("SELECT phone_lookup FROM elder_number_flags LIMIT 1")
        .fetch_one(&state.pool)
        .await
        .unwrap();
    assert_ne!(stored, phone);
    assert!(!stored.contains("139"));

    let (status, check) = send(
        &router,
        Method::GET,
        "/v1/elder/number-flags/check?phone=%2B8613990000001",
        Some(("Bearer", other_access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{check}");
    assert_eq!(check["flagged"], true);
    assert!(check.get("user_id").is_none() || check["user_id"].is_null());
    assert!(check["count"].as_i64().unwrap() >= 1);
}

#[tokio::test]
async fn activity_log_is_opt_in_and_caregiver_cannot_enable_it() {
    let (router, _) = world().await;
    let elder = register_user(&router, "log@qingxin.app", "老人").await;
    let child = register_user(&router, "log-child@qingxin.app", "子女").await;
    let elder_access = elder["access_token"].as_str().unwrap();
    let child_access = child["access_token"].as_str().unwrap();
    let elder_id = elder["user"]["id"].as_str().unwrap();
    link_pair(&router, elder_access, child_access).await;

    let (status, denied) = send(
        &router,
        Method::GET,
        &format!("/v1/elder/{elder_id}/activity"),
        Some(("Bearer", child_access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{denied}");

    let (status, sneak) = send(
        &router,
        Method::PATCH,
        &format!("/v1/elder/{elder_id}/profile"),
        Some(("Bearer", child_access)),
        Some(json!({ "activity_log_opt_in": true })),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{sneak}");

    let (status, enabled) = send(
        &router,
        Method::PATCH,
        &format!("/v1/elder/{elder_id}/profile"),
        Some(("Bearer", elder_access)),
        Some(json!({ "activity_log_opt_in": true })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{enabled}");

    let (status, ack_contact) = send(
        &router,
        Method::POST,
        &format!("/v1/elder/{elder_id}/contacts"),
        Some(("Bearer", elder_access)),
        Some(json!({ "name": "儿子", "relation": "子女", "phone": "+8613800138002" })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{ack_contact}");
    let contact_id = ack_contact["id"].as_str().unwrap();

    let (status, tapped) = send(
        &router,
        Method::POST,
        &format!("/v1/elder/{elder_id}/activity"),
        Some(("Bearer", elder_access)),
        Some(json!({ "event_type": "call_tapped", "contact_id": contact_id })),
    )
    .await;
    assert!(status.is_success(), "{tapped}");

    let (status, log) = send(
        &router,
        Method::GET,
        &format!("/v1/elder/{elder_id}/activity"),
        Some(("Bearer", child_access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{log}");
    let blob = log.to_string();
    assert!(!blob.contains("13800138002"), "{log}");
}

#[tokio::test]
async fn elder_ai_explain_uses_unconfigured_gateway() {
    let mut state = AppState::connect(Config::test()).await.expect("connect");
    state.ai = Arc::new(UnconfiguredAiGateway);
    let router = app(state);
    let elder = register_user(&router, "ai@qingxin.app", "老人").await;
    let access = elder["access_token"].as_str().unwrap();
    let (status, body) = send(
        &router,
        Method::POST,
        "/v1/elder/ai/explain",
        Some(("Bearer", access)),
        Some(json!({ "topic": "刷单返利" })),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_IMPLEMENTED, "{body}");
    assert_eq!(body["error"]["code"], "ai_unconfigured");
}

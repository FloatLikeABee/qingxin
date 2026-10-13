use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
};
use chrono::{Duration, Utc};
use qingxin_api::ai::{QingxinAiGateway, UnconfiguredAiGateway};
use qingxin_api::{app, scheduler, AppState, Config};
use serde_json::{json, Value};
use std::sync::Arc;
use tower::ServiceExt;

fn shanghai_today() -> chrono::NaiveDate {
    (Utc::now() + Duration::hours(8)).date_naive()
}

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
            "display_name": "打卡同学",
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
async fn study_requires_auth() {
    let (router, _) = world().await;
    let (status, body) = send(&router, Method::GET, "/v1/study/today", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"]["code"], "unauthenticated");
}

#[tokio::test]
async fn challenge_length_and_idempotent_streak() {
    let (router, _) = world().await;
    let (token, _) = register(&router, "streak@qingxin.app").await;

    let (status, bad) = send(
        &router,
        Method::POST,
        "/v1/study/challenges",
        Some(&token),
        Some(json!({ "name": "三十天", "target_days": 30 })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{bad}");
    assert_eq!(bad["error"]["code"], "invalid_request");

    let (status, created) = send(
        &router,
        Method::POST,
        "/v1/study/challenges",
        Some(&token),
        Some(json!({
            "name": "背单词",
            "target_days": 21,
            "timezone": "Asia/Shanghai"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    assert_eq!(created["target_days"], 21);
    assert_eq!(created["timezone"], "Asia/Shanghai");
    assert_eq!(created["current_streak"], 0);
    let id = created["id"].as_str().unwrap();

    let today = shanghai_today();
    let day = json!({ "day": today.to_string() });
    let (status, first) = send(
        &router,
        Method::POST,
        &format!("/v1/study/challenges/{id}/checkins"),
        Some(&token),
        Some(day.clone()),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{first}");
    let (status, again) = send(
        &router,
        Method::POST,
        &format!("/v1/study/challenges/{id}/checkins"),
        Some(&token),
        Some(day),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{again}");
    assert_eq!(again["id"], first["id"]);

    let (status, _) = send(
        &router,
        Method::POST,
        &format!("/v1/study/challenges/{id}/checkins"),
        Some(&token),
        Some(json!({ "day": (today - Duration::days(1)).to_string() })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let (status, _) = send(
        &router,
        Method::POST,
        &format!("/v1/study/challenges/{id}/checkins"),
        Some(&token),
        Some(json!({ "day": (today - Duration::days(2)).to_string() })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);

    let (status, got) = send(
        &router,
        Method::GET,
        &format!("/v1/study/challenges/{id}"),
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{got}");
    assert_eq!(got["current_streak"], 3);
    assert_eq!(got["progress_days"], 3);

    let (status, today) = send(&router, Method::GET, "/v1/study/today", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK, "{today}");
    assert_eq!(
        today["disclaimer"],
        "本模块为学习习惯记录工具，不构成教学辅导或心理咨询。"
    );
}

#[tokio::test]
async fn streak_gap_resets_and_timezone_days_stay_independent() {
    let (router, _) = world().await;
    let (token, _) = register(&router, "tz@qingxin.app").await;

    let (status, gap) = send(
        &router,
        Method::POST,
        "/v1/study/challenges",
        Some(&token),
        Some(json!({ "name": "断签", "target_days": 14 })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{gap}");
    let gap_id = gap["id"].as_str().unwrap();
    let today = shanghai_today();
    for day in [today - Duration::days(3), today] {
        let (status, _) = send(
            &router,
            Method::POST,
            &format!("/v1/study/challenges/{gap_id}/checkins"),
            Some(&token),
            Some(json!({ "day": day.to_string() })),
        )
        .await;
        assert_eq!(status, StatusCode::CREATED);
    }
    let (status, got) = send(
        &router,
        Method::GET,
        &format!("/v1/study/challenges/{gap_id}"),
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{got}");
    assert_eq!(got["current_streak"], 1);

    let (status, utc) = send(
        &router,
        Method::POST,
        "/v1/study/challenges",
        Some(&token),
        Some(json!({ "name": "UTC营", "target_days": 7, "timezone": "UTC" })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{utc}");
    let utc_id = utc["id"].as_str().unwrap();
    let (status, utc_check) = send(
        &router,
        Method::POST,
        &format!("/v1/study/challenges/{utc_id}/checkins"),
        Some(&token),
        Some(json!({ "day": "2026-10-12" })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{utc_check}");
    assert_eq!(utc_check["day"], "2026-10-12");

    let (status, sh) = send(
        &router,
        Method::POST,
        "/v1/study/challenges",
        Some(&token),
        Some(json!({ "name": "上海营", "target_days": 7, "timezone": "Asia/Shanghai" })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{sh}");
    let sh_id = sh["id"].as_str().unwrap();
    let (status, sh_check) = send(
        &router,
        Method::POST,
        &format!("/v1/study/challenges/{sh_id}/checkins"),
        Some(&token),
        Some(json!({ "day": "2026-10-13" })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{sh_check}");
    assert_eq!(sh_check["day"], "2026-10-13");
}

#[tokio::test]
async fn cross_user_and_caregiver_study_is_404() {
    let (router, _) = world().await;
    let (alice, _) = register(&router, "alice-study@qingxin.app").await;
    let (bob, _) = register(&router, "bob-study@qingxin.app").await;
    let (care, _) = register(&router, "care-study@qingxin.app").await;
    link_pair(&router, &alice, &care).await;

    let (status, created) = send(
        &router,
        Method::POST,
        "/v1/study/challenges",
        Some(&alice),
        Some(json!({ "name": "Alice营", "target_days": 7 })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    let id = created["id"].as_str().unwrap();

    let (status, body) = send(
        &router,
        Method::GET,
        &format!("/v1/study/challenges/{id}"),
        Some(&bob),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{body}");

    let (status, body) = send(
        &router,
        Method::POST,
        &format!("/v1/study/challenges/{id}/checkins"),
        Some(&care),
        Some(json!({ "day": "2026-10-13" })),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{body}");

    let (status, today) = send(&router, Method::GET, "/v1/study/today", Some(&care), None).await;
    assert_eq!(status, StatusCode::OK, "{today}");
    assert_eq!(today["challenges"].as_array().unwrap().len(), 0);
}

#[tokio::test]
async fn flashcards_encrypted_and_good_grade_advances() {
    let (router, state) = world().await;
    let (token, _) = register(&router, "cards@qingxin.app").await;

    let (status, rejected) = send(
        &router,
        Method::POST,
        "/v1/study/flashcards",
        Some(&token),
        Some(json!({
            "front": "x",
            "back": "y",
            "file_url": "https://example.com/a.jpg"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{rejected}");

    let (status, created) = send(
        &router,
        Method::POST,
        "/v1/study/flashcards",
        Some(&token),
        Some(json!({
            "front": "过去分词",
            "back": "done / gone",
            "category": "英语"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    assert_eq!(created["front"], "过去分词");
    assert_eq!(created["interval_days"], 0);
    let id = created["id"].as_str().unwrap();

    let blob: Vec<u8> =
        sqlx::query_scalar("SELECT front_encrypted FROM study_flashcards WHERE id = ?")
            .bind(id)
            .fetch_one(&state.pool)
            .await
            .unwrap();
    assert!(!blob.is_empty());
    assert_ne!(blob, "过去分词".as_bytes());

    let (status, first) = send(
        &router,
        Method::POST,
        &format!("/v1/study/flashcards/{id}/review"),
        Some(&token),
        Some(json!({ "grade": "good" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{first}");
    assert_eq!(first["interval_days"], 1);

    let (status, second) = send(
        &router,
        Method::POST,
        &format!("/v1/study/flashcards/{id}/review"),
        Some(&token),
        Some(json!({ "grade": "good" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{second}");
    assert_eq!(second["interval_days"], 6);
    let next = second["next_review_date"].as_str().unwrap();
    let today = shanghai_today().to_string();
    assert!(next > today.as_str(), "next={next} today={today}");
}

#[tokio::test]
async fn classify_uses_ai_gateway_and_unconfigured_is_501() {
    let (router, _) = world_ai("英语").await;
    let (token, _) = register(&router, "classify@qingxin.app").await;
    let (status, classified) = send(
        &router,
        Method::POST,
        "/v1/study/flashcards/classify",
        Some(&token),
        Some(json!({ "front": "过去分词", "back": "past participle" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{classified}");
    assert_eq!(classified["category"], "英语");
    assert!(classified["disclaimer"]
        .as_str()
        .unwrap()
        .contains("学习习惯"));

    let mut state = AppState::connect(Config::test())
        .await
        .expect("connect test db");
    state.ai = Arc::new(UnconfiguredAiGateway);
    let router = app(state.clone());
    let (token, _) = register(&router, "classify-off@qingxin.app").await;
    let (status, body) = send(
        &router,
        Method::POST,
        "/v1/study/flashcards/classify",
        Some(&token),
        Some(json!({ "front": "x", "back": "y" })),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_IMPLEMENTED, "{body}");
    assert_eq!(body["error"]["code"], "ai_unconfigured");
}

#[tokio::test]
async fn notes_encrypted_and_search_skips_body() {
    let (router, state) = world().await;
    let (token, _) = register(&router, "notes@qingxin.app").await;

    let (status, created) = send(
        &router,
        Method::POST,
        "/v1/study/notes",
        Some(&token),
        Some(json!({
            "title": "动词",
            "content_md": "# 摘要\n秘密句子",
            "tags": ["语法"]
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    assert_eq!(created["content_md"], "# 摘要\n秘密句子");
    let id = created["id"].as_str().unwrap();
    let blob: Vec<u8> =
        sqlx::query_scalar("SELECT content_md_encrypted FROM study_notes WHERE id = ?")
            .bind(id)
            .fetch_one(&state.pool)
            .await
            .unwrap();
    assert!(!blob.is_empty());
    assert!(!String::from_utf8_lossy(&blob).contains("秘密句子"));

    let (status, by_title) = send(
        &router,
        Method::GET,
        "/v1/study/notes?q=%E5%8A%A8%E8%AF%8D",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{by_title}");
    assert_eq!(by_title["items"].as_array().unwrap().len(), 1);

    let (status, by_tag) = send(
        &router,
        Method::GET,
        "/v1/study/notes?q=%E8%AF%AD%E6%B3%95",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{by_tag}");
    assert_eq!(by_tag["items"].as_array().unwrap().len(), 1);

    let (status, by_body) = send(
        &router,
        Method::GET,
        "/v1/study/notes?q=%E7%A7%98%E5%AF%86%E5%8F%A5%E5%AD%90",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{by_body}");
    assert_eq!(by_body["items"].as_array().unwrap().len(), 0);
}

#[tokio::test]
async fn skills_copy_template_and_custom_node() {
    let (router, _) = world().await;
    let (token, _) = register(&router, "skills@qingxin.app").await;

    let (status, templates) = send(
        &router,
        Method::GET,
        "/v1/study/skills/templates",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{templates}");
    let template_id = templates["items"][0]["id"].as_str().unwrap();

    let (status, copied) = send(
        &router,
        Method::POST,
        "/v1/study/skills/from-template",
        Some(&token),
        Some(json!({ "template_id": template_id })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{copied}");
    assert!(!copied["items"].as_array().unwrap().is_empty());

    let (status, custom) = send(
        &router,
        Method::POST,
        "/v1/study/skills",
        Some(&token),
        Some(json!({ "title": "即兴伴奏" })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{custom}");
    assert_eq!(custom["title"], "即兴伴奏");
    assert!(custom["parent_id"].is_null());
}

#[tokio::test]
async fn streak_reminder_skips_checked_in_day() {
    let (router, state) = world().await;
    let (token, _) = register(&router, "nag@qingxin.app").await;

    let (status, challenge) = send(
        &router,
        Method::POST,
        "/v1/study/challenges",
        Some(&token),
        Some(json!({ "name": "提醒营", "target_days": 7 })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{challenge}");
    let challenge_id = challenge["id"].as_str().unwrap();

    let (status, reminder) = send(
        &router,
        Method::POST,
        "/v1/study/reminders",
        Some(&token),
        Some(json!({
            "kind": "streak",
            "time_local": "21:00",
            "days_of_week": [1, 2, 3, 4, 5, 6, 7],
            "timezone": "Asia/Shanghai"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{reminder}");

    let (status, jobs) = send(&router, Method::GET, "/v1/jobs", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK, "{jobs}");
    let job = jobs["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| row["payload"]["type"] == "study.streak" && row["status"] == "pending")
        .cloned()
        .expect("streak job");
    assert_eq!(job["kind"], "web_push");

    let today = challenge["start_date"].as_str().unwrap();
    let (status, _) = send(
        &router,
        Method::POST,
        &format!("/v1/study/challenges/{challenge_id}/checkins"),
        Some(&token),
        Some(json!({ "day": today })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);

    sqlx::query("UPDATE scheduled_jobs SET run_at = ? WHERE id = ?")
        .bind("2020-01-01T00:00:00Z")
        .bind(job["id"].as_str().unwrap())
        .execute(&state.pool)
        .await
        .unwrap();
    let sent_before = state.push.sent();
    let _ = scheduler::tick_once(&state).await.expect("tick");
    assert_eq!(state.push.sent(), sent_before);
}

#[tokio::test]
async fn missed_streak_and_review_jobs_push() {
    let (router, state) = world().await;
    let (token, _) = register(&router, "miss@qingxin.app").await;

    let (status, _) = send(
        &router,
        Method::POST,
        "/v1/study/challenges",
        Some(&token),
        Some(json!({ "name": "未打卡", "target_days": 7 })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);

    let (status, _) = send(
        &router,
        Method::POST,
        "/v1/study/reminders",
        Some(&token),
        Some(json!({
            "kind": "streak",
            "time_local": "21:00",
            "days_of_week": [1, 2, 3, 4, 5, 6, 7]
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let (status, _) = send(
        &router,
        Method::POST,
        "/v1/study/reminders",
        Some(&token),
        Some(json!({
            "kind": "review",
            "time_local": "20:00",
            "days_of_week": [1, 2, 3, 4, 5, 6, 7]
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);

    let (status, jobs) = send(&router, Method::GET, "/v1/jobs", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK, "{jobs}");
    for row in jobs["items"].as_array().unwrap() {
        if row["payload"]["type"] == "study.streak" || row["payload"]["type"] == "study.review" {
            sqlx::query("UPDATE scheduled_jobs SET run_at = ? WHERE id = ?")
                .bind("2020-01-01T00:00:00Z")
                .bind(row["id"].as_str().unwrap())
                .execute(&state.pool)
                .await
                .unwrap();
        }
    }
    let sent_before = state.push.sent();
    let sent = scheduler::tick_once(&state).await.expect("tick");
    assert!(sent >= 2);
    assert!(state.push.sent() >= sent_before + 2);
}

#[tokio::test]
async fn focus_has_no_api_and_privacy_hooks_cover_study() {
    let (router, state) = world().await;
    let (token, user_id) = register(&router, "export-study@qingxin.app").await;

    let (status, _) = send(&router, Method::POST, "/v1/study/focus", Some(&token), None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    let (status, challenge) = send(
        &router,
        Method::POST,
        "/v1/study/challenges",
        Some(&token),
        Some(json!({ "name": "导出营", "target_days": 7 })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{challenge}");
    let cid = challenge["id"].as_str().unwrap();
    let (status, _) = send(
        &router,
        Method::POST,
        &format!("/v1/study/challenges/{cid}/checkins"),
        Some(&token),
        Some(json!({ "day": "2026-10-13" })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let (status, note) = send(
        &router,
        Method::POST,
        "/v1/study/notes",
        Some(&token),
        Some(json!({ "title": "笔记", "content_md": "# 摘要" })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{note}");

    let (status, export) = send(
        &router,
        Method::GET,
        "/v1/privacy/export",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{export}");
    assert_eq!(export["study"]["challenges"][0]["name"], "导出营");
    assert_eq!(export["study"]["notes"][0]["content_md"], "# 摘要");

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
        sqlx::query_scalar("SELECT COUNT(*) FROM study_challenges WHERE user_id = ?")
            .bind(&user_id)
            .fetch_one(&state.pool)
            .await
            .unwrap();
    assert_eq!(leftover, 0);
}

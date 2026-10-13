use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
};
use chrono::{Duration, Utc};
use qingxin_api::{app, scheduler, AppState, Config};
use serde_json::{json, Value};
use sqlx::Row;
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

async fn register(router: &axum::Router, email: &str) -> (String, String) {
    let (status, body) = send(
        router,
        Method::POST,
        "/v1/auth/register",
        None,
        Some(json!({
            "email": email,
            "password": "correct-horse",
            "display_name": "记账同学",
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

fn shanghai_today() -> chrono::NaiveDate {
    (Utc::now() + Duration::hours(8)).date_naive()
}

async fn category_id(router: &axum::Router, token: &str, name: &str) -> String {
    let (status, body) = send(
        router,
        Method::GET,
        "/v1/finance/categories",
        Some(token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    body["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|item| item["name"] == name)
        .and_then(|item| item["id"].as_str())
        .unwrap_or_else(|| panic!("missing category {name} in {body}"))
        .to_string()
}

#[tokio::test]
async fn finance_requires_auth() {
    let (router, _) = world().await;
    let (status, body) = send(&router, Method::GET, "/v1/finance/categories", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"]["code"], "unauthenticated");
}

#[tokio::test]
async fn records_expense_rejects_bad_amount_and_is_idempotent() {
    let (router, _) = world().await;
    let (token, _) = register(&router, "ledger@qingxin.app").await;
    let food = category_id(&router, &token, "餐饮").await;
    let client_id = "11111111-1111-4111-8111-111111111111";

    let (status, bad) = send(
        &router,
        Method::POST,
        "/v1/finance/transactions",
        Some(&token),
        Some(json!({
            "amount_fen": 0,
            "type": "expense",
            "category_id": food,
            "occurred_on": "2026-10-13",
            "client_id": "22222222-2222-4222-8222-222222222222"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{bad}");
    assert_eq!(bad["error"]["code"], "invalid_request");

    let (status, usd) = send(
        &router,
        Method::POST,
        "/v1/finance/transactions",
        Some(&token),
        Some(json!({
            "amount_fen": 100,
            "currency": "USD",
            "type": "expense",
            "category_id": food,
            "occurred_on": "2026-10-13",
            "client_id": "33333333-3333-4333-8333-333333333333"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{usd}");

    let payload = json!({
        "amount_fen": 2550,
        "type": "expense",
        "category_id": food,
        "note": "午饭",
        "occurred_on": "2026-10-13",
        "client_id": client_id
    });
    let (status, first) = send(
        &router,
        Method::POST,
        "/v1/finance/transactions",
        Some(&token),
        Some(payload.clone()),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{first}");
    assert_eq!(first["amount_fen"], 2550);
    assert_eq!(first["currency"], "CNY");
    assert_eq!(first["type"], "expense");
    assert_eq!(first["note"], "午饭");
    assert_eq!(first["category_name"], "餐饮");

    let (status, retry) = send(
        &router,
        Method::POST,
        "/v1/finance/transactions",
        Some(&token),
        Some(payload),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{retry}");
    assert_eq!(retry["id"], first["id"]);

    let (status, listed) = send(
        &router,
        Method::GET,
        "/v1/finance/transactions?month=2026-10",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{listed}");
    assert_eq!(listed["items"].as_array().unwrap().len(), 1);
    assert_eq!(listed["items"][0]["currency"], "CNY");
}

#[tokio::test]
async fn cross_user_transaction_is_404() {
    let (router, _) = world().await;
    let (alice, _) = register(&router, "alice-fin@qingxin.app").await;
    let (bob, _) = register(&router, "bob-fin@qingxin.app").await;
    let food = category_id(&router, &alice, "餐饮").await;

    let (status, created) = send(
        &router,
        Method::POST,
        "/v1/finance/transactions",
        Some(&alice),
        Some(json!({
            "amount_fen": 900,
            "type": "expense",
            "category_id": food,
            "occurred_on": "2026-10-13",
            "client_id": "44444444-4444-4444-8444-444444444444"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    let id = created["id"].as_str().unwrap();

    let (status, get) = send(
        &router,
        Method::GET,
        &format!("/v1/finance/transactions/{id}"),
        Some(&bob),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{get}");
    assert_eq!(get["error"]["code"], "not_found");

    let (status, patch) = send(
        &router,
        Method::PATCH,
        &format!("/v1/finance/transactions/{id}"),
        Some(&bob),
        Some(json!({ "note": "偷改" })),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{patch}");

    let (status, delete) = send(
        &router,
        Method::DELETE,
        &format!("/v1/finance/transactions/{id}"),
        Some(&bob),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{delete}");
}

#[tokio::test]
async fn summary_flags_budget_alert_and_report_has_mom_yoy() {
    let (router, _) = world().await;
    let (token, _) = register(&router, "budget@qingxin.app").await;
    let food = category_id(&router, &token, "餐饮").await;

    let (status, budgets) = send(
        &router,
        Method::PUT,
        "/v1/finance/budgets",
        Some(&token),
        Some(json!({
            "items": [{
                "category_id": food,
                "monthly_limit_fen": 100_000,
                "alert_threshold_pct": 80
            }]
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{budgets}");

    let (status, tx) = send(
        &router,
        Method::POST,
        "/v1/finance/transactions",
        Some(&token),
        Some(json!({
            "amount_fen": 85_000,
            "type": "expense",
            "category_id": food,
            "occurred_on": "2026-10-08",
            "client_id": "55555555-5555-4555-8555-555555555555"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{tx}");

    for (day, client) in [
        ("2026-09-10", "66666666-6666-4666-8666-666666666666"),
        ("2025-10-10", "77777777-7777-4777-8777-777777777777"),
    ] {
        let (status, prev) = send(
            &router,
            Method::POST,
            "/v1/finance/transactions",
            Some(&token),
            Some(json!({
                "amount_fen": 10_000,
                "type": "expense",
                "category_id": food,
                "occurred_on": day,
                "client_id": client
            })),
        )
        .await;
        assert_eq!(status, StatusCode::CREATED, "{prev}");
    }

    let (status, summary) = send(
        &router,
        Method::GET,
        "/v1/finance/summary?month=2026-10",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{summary}");
    assert_eq!(summary["currency"], "CNY");
    assert_eq!(summary["expense_fen"], 85_000);
    let food_budget = summary["budgets"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| row["category_id"] == food)
        .cloned()
        .expect("food budget");
    assert_eq!(food_budget["pct"], 85);
    assert_eq!(food_budget["alert"], true);
    assert_eq!(summary["recent"].as_array().unwrap().len(), 1);

    let (status, report) = send(
        &router,
        Method::GET,
        "/v1/finance/report?from=2026-10&to=2026-10&group=category",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{report}");
    assert!(report["mom"]["expense_delta_fen"].as_i64().is_some());
    assert!(report["yoy"]["expense_delta_fen"].as_i64().is_some());
}

#[tokio::test]
async fn subscriptions_upcoming_roll_forward_and_schedule_push() {
    let (router, state) = world().await;
    let (token, _) = register(&router, "subs@qingxin.app").await;
    let today = shanghai_today();
    let soon = (today + Duration::days(2)).to_string();

    let (status, created) = send(
        &router,
        Method::POST,
        "/v1/finance/subscriptions",
        Some(&token),
        Some(json!({
            "name": "音乐会员",
            "price_fen": 3000,
            "cycle": "monthly",
            "next_billing_date": soon,
            "remind_days_before": 3
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    assert_eq!(created["annual_cost_fen"], 36_000);
    assert_eq!(created["currency"], "CNY");

    let (status, upcoming) = send(
        &router,
        Method::GET,
        "/v1/finance/subscriptions/upcoming?days=7",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{upcoming}");
    assert_eq!(upcoming["items"].as_array().unwrap().len(), 1);

    let (status, jobs) = send(&router, Method::GET, "/v1/jobs", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK, "{jobs}");
    let job = jobs["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| row["payload"]["source"] == "finance_subscription")
        .cloned()
        .expect("reminder job");
    assert_eq!(job["kind"], "web_push");

    let sent_before = state.push.sent();
    let sent = scheduler::tick_once(&state).await.expect("tick");
    assert!(sent >= 1);
    assert!(state.push.sent() > sent_before);

    let past = (today - Duration::days(1)).to_string();
    let (status, old) = send(
        &router,
        Method::POST,
        "/v1/finance/subscriptions",
        Some(&token),
        Some(json!({
            "name": "过期套餐",
            "price_fen": 1000,
            "cycle": "monthly",
            "next_billing_date": past,
            "remind_days_before": 3
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{old}");
    let old_id = old["id"].as_str().unwrap();

    let (status, listed) = send(
        &router,
        Method::GET,
        "/v1/finance/subscriptions",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{listed}");
    let rolled = listed["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| row["id"] == old_id)
        .cloned()
        .unwrap();
    let next = rolled["next_billing_date"].as_str().unwrap();
    assert!(next > past.as_str(), "expected roll-forward, got {next}");
    assert!(next >= today.to_string().as_str());
}

#[tokio::test]
async fn challenge_checkin_is_manual_and_idempotent() {
    let (router, _) = world().await;
    let (token, _) = register(&router, "challenge@qingxin.app").await;
    let (status, created) = send(
        &router,
        Method::POST,
        "/v1/finance/challenges",
        Some(&token),
        Some(json!({
            "name": "不买奶茶 30 天",
            "target_days": 30,
            "start_date": "2026-10-01"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    let id = created["id"].as_str().unwrap();

    let day = json!({ "day": "2026-10-13" });
    let (status, first) = send(
        &router,
        Method::POST,
        &format!("/v1/finance/challenges/{id}/checkins"),
        Some(&token),
        Some(day.clone()),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{first}");

    let (status, again) = send(
        &router,
        Method::POST,
        &format!("/v1/finance/challenges/{id}/checkins"),
        Some(&token),
        Some(day),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{again}");
    assert_eq!(again["id"], first["id"]);

    let (status, listed) = send(
        &router,
        Method::GET,
        "/v1/finance/challenges",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{listed}");
    assert_eq!(listed["items"][0]["progress_days"], 1);
}

#[tokio::test]
async fn notes_are_encrypted_and_privacy_hooks_cover_finance() {
    let (router, state) = world().await;
    let (token, user_id) = register(&router, "vault@qingxin.app").await;
    let food = category_id(&router, &token, "餐饮").await;

    let (status, created) = send(
        &router,
        Method::POST,
        "/v1/finance/transactions",
        Some(&token),
        Some(json!({
            "amount_fen": 1200,
            "type": "expense",
            "category_id": food,
            "note": "午饭",
            "occurred_on": "2026-10-13",
            "client_id": "88888888-8888-4888-8888-888888888888"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");

    let row = sqlx::query("SELECT note_encrypted, amount_fen FROM fin_transactions WHERE id = ?")
        .bind(created["id"].as_str().unwrap())
        .fetch_one(&state.pool)
        .await
        .unwrap();
    let blob: Vec<u8> = row.get("note_encrypted");
    let amount: i64 = row.get("amount_fen");
    assert!(!blob.is_empty());
    assert_ne!(blob, "午饭".as_bytes());
    assert_eq!(amount, 1200);

    let (status, export) = send(
        &router,
        Method::GET,
        "/v1/privacy/export",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{export}");
    assert_eq!(export["finance"]["transactions"][0]["note"], "午饭");
    assert_eq!(export["finance"]["transactions"][0]["amount_fen"], 1200);

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
        sqlx::query_scalar("SELECT COUNT(*) FROM fin_transactions WHERE user_id = ?")
            .bind(&user_id)
            .fetch_one(&state.pool)
            .await
            .unwrap();
    assert_eq!(leftover, 0);
    let leftover_subs: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM fin_subscriptions WHERE user_id = ?")
            .bind(&user_id)
            .fetch_one(&state.pool)
            .await
            .unwrap();
    assert_eq!(leftover_subs, 0);
}

use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
};
use qingxin_api::ai::{
    AiError, AiGateway, CompletionRequest, CompletionResponse, UnconfiguredAiGateway,
};
use qingxin_api::{app, AppState, Config};
use serde_json::{json, Value};
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
async fn resume_create_versions_isolation_and_validation() {
    let (router, _) = world().await;
    let a = register_user(&router, "a-resume@qingxin.app").await;
    let b = register_user(&router, "b-resume@qingxin.app").await;
    let a_tok = a["access_token"].as_str().unwrap();
    let b_tok = b["access_token"].as_str().unwrap();

    let (status, denied) = send(
        &router,
        Method::POST,
        "/v1/hustle/resumes",
        None,
        Some(json!({"content": {"name": "林轻心"}})),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(denied["error"]["code"], "unauthenticated");

    let (status, first) = send(
        &router,
        Method::POST,
        "/v1/hustle/resumes",
        Some(("Bearer", a_tok)),
        Some(json!({
            "title": "投前端",
            "content": {
                "name": "林轻心",
                "title": "前端工程师",
                "summary": "喜欢把界面做安静一点。"
            }
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{first}");
    assert_eq!(first["version"], 1);
    assert_eq!(first["content"]["name"], "林轻心");
    assert_eq!(first["pdf_url"], Value::Null);

    let (status, second) = send(
        &router,
        Method::POST,
        "/v1/hustle/resumes",
        Some(("Bearer", a_tok)),
        Some(json!({"content": {"name": "林轻心", "title": "全栈"}})),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{second}");
    assert_eq!(second["version"], 2);

    let (status, bad) = send(
        &router,
        Method::POST,
        "/v1/hustle/resumes",
        Some(("Bearer", a_tok)),
        Some(json!({"content": {"title": "没有姓名"}})),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(bad["error"]["code"], "invalid_request");

    let (status, patched) = send(
        &router,
        Method::PATCH,
        &format!("/v1/hustle/resumes/{}", first["id"].as_str().unwrap()),
        Some(("Bearer", a_tok)),
        Some(json!({"content": {"name": "林轻心", "summary": "改了一版"}})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{patched}");
    assert_eq!(patched["content"]["summary"], "改了一版");
    assert_eq!(patched["version"], 1);

    let (status, listed) = send(
        &router,
        Method::GET,
        "/v1/hustle/resumes",
        Some(("Bearer", b_tok)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{listed}");
    assert!(listed["items"].as_array().unwrap().is_empty());
}

#[tokio::test]
async fn applications_kanban_funnel_and_isolation() {
    let (router, _) = world().await;
    let a = register_user(&router, "a-job@qingxin.app").await;
    let b = register_user(&router, "b-job@qingxin.app").await;
    let a_tok = a["access_token"].as_str().unwrap();
    let b_tok = b["access_token"].as_str().unwrap();

    let (status, denied) = send(
        &router,
        Method::POST,
        "/v1/hustle/applications",
        None,
        Some(json!({"company": "轻心实验室", "position": "前端工程师"})),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(denied["error"]["code"], "unauthenticated");

    let (status, first) = send(
        &router,
        Method::POST,
        "/v1/hustle/applications",
        Some(("Bearer", a_tok)),
        Some(json!({"company": "轻心实验室", "position": "前端工程师"})),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{first}");
    assert_eq!(first["status"], "投递");

    let (status, second) = send(
        &router,
        Method::POST,
        "/v1/hustle/applications",
        Some(("Bearer", a_tok)),
        Some(json!({"company": "河岸工作室", "position": "产品"})),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{second}");

    let (status, moved) = send(
        &router,
        Method::PATCH,
        &format!("/v1/hustle/applications/{}", first["id"].as_str().unwrap()),
        Some(("Bearer", a_tok)),
        Some(json!({
            "status": "面试",
            "interview_date": "2026-10-13",
            "notes": "问了盒模型"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{moved}");
    assert_eq!(moved["status"], "面试");
    assert_eq!(moved["notes"], "问了盒模型");
    assert!(moved["interview_date"]
        .as_str()
        .unwrap()
        .contains("2026-10-13"));

    let (status, bad_status) = send(
        &router,
        Method::PATCH,
        &format!("/v1/hustle/applications/{}", first["id"].as_str().unwrap()),
        Some(("Bearer", a_tok)),
        Some(json!({"status": "归档"})),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(bad_status["error"]["code"], "invalid_request");

    let (status, missing) = send(
        &router,
        Method::POST,
        "/v1/hustle/applications",
        Some(("Bearer", a_tok)),
        Some(json!({"company": "", "position": "前端"})),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(missing["error"]["code"], "invalid_request");

    let (status, funnel) = send(
        &router,
        Method::GET,
        "/v1/hustle/funnel",
        Some(("Bearer", a_tok)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{funnel}");
    let stages = funnel["stages"].as_array().unwrap();
    assert_eq!(stages[0]["status"], "投递");
    assert_eq!(stages[0]["count"], 1);
    assert_eq!(stages[1]["status"], "面试");
    assert_eq!(stages[1]["count"], 1);
    assert_eq!(stages[2]["status"], "Offer");
    assert_eq!(stages[2]["count"], 0);

    let (status, other) = send(
        &router,
        Method::GET,
        "/v1/hustle/applications",
        Some(("Bearer", b_tok)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{other}");
    assert!(other["items"].as_array().unwrap().is_empty());
}

#[tokio::test]
async fn application_client_id_is_idempotent() {
    let (router, state) = world().await;
    let created = register_user(&router, "idem@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();
    let id = "22222222-2222-4222-8222-222222222222";
    let body = json!({
        "id": id,
        "company": "轻心实验室",
        "position": "前端工程师"
    });
    let (status, first) = send(
        &router,
        Method::POST,
        "/v1/hustle/applications",
        Some(("Bearer", access)),
        Some(body.clone()),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{first}");
    let (status, second) = send(
        &router,
        Method::POST,
        "/v1/hustle/applications",
        Some(("Bearer", access)),
        Some(body),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{second}");
    assert_eq!(second["id"], id);
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM applications WHERE id = ?")
        .bind(id)
        .fetch_one(&state.pool)
        .await
        .unwrap();
    assert_eq!(count, 1);
}

#[tokio::test]
async fn side_hustles_and_question_catalog_filter() {
    let (router, _) = world().await;
    let created = register_user(&router, "side@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();

    let (status, online) = send(
        &router,
        Method::POST,
        "/v1/hustle/side-hustles",
        Some(("Bearer", access)),
        Some(json!({
            "title": "文档翻译",
            "platform": "线上接单",
            "estimated_income": 2000,
            "skills_required": ["英语"],
            "kind": "线上"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{online}");

    let (status, offline) = send(
        &router,
        Method::POST,
        "/v1/hustle/side-hustles",
        Some(("Bearer", access)),
        Some(json!({
            "title": "周末摄影",
            "platform": "本地",
            "estimated_income": 800,
            "skills_required": ["摄影"],
            "kind": "线下"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{offline}");

    let (status, filtered) = send(
        &router,
        Method::GET,
        "/v1/hustle/side-hustles?kind=%E7%BA%BF%E4%B8%8B",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{filtered}");
    let items = filtered["items"].as_array().unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["id"], offline["id"]);

    let (status, questions) = send(
        &router,
        Method::GET,
        "/v1/hustle/questions?role=%E5%89%8D%E7%AB%AF",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{questions}");
    let bank = questions["items"].as_array().unwrap();
    assert!(!bank.is_empty());
    for item in bank {
        assert_eq!(item["role"], "前端");
    }

    let (status, bad_role) = send(
        &router,
        Method::GET,
        "/v1/hustle/questions?role=%E6%B3%95%E5%8A%A1",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(bad_role["error"]["code"], "invalid_request");
}

#[tokio::test]
async fn hustle_ai_falls_back_to_deterministic_mock() {
    let (router, _) = world().await;
    let created = register_user(&router, "ai@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();

    let (status, resume) = send(
        &router,
        Method::POST,
        "/v1/hustle/resumes",
        Some(("Bearer", access)),
        Some(json!({"content": {"name": "林轻心", "title": "前端工程师"}})),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{resume}");

    let (status, opt) = send(
        &router,
        Method::POST,
        &format!(
            "/v1/hustle/resumes/{}/optimize",
            resume["id"].as_str().unwrap()
        ),
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{opt}");
    assert_eq!(opt["source"], "mock");
    assert!(opt["text"].as_str().unwrap().contains("林轻心"));
    assert!(opt["disclaimer"].as_str().unwrap().contains("不构成"));

    let (status, catalog) = send(
        &router,
        Method::GET,
        "/v1/hustle/questions",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{catalog}");
    let qid = catalog["items"][0]["id"].as_str().unwrap();
    let (status, mock_a) = send(
        &router,
        Method::POST,
        "/v1/hustle/interviews/mock",
        Some(("Bearer", access)),
        Some(json!({"question_id": qid})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{mock_a}");
    assert_eq!(mock_a["source"], "mock");
    let (status, mock_b) = send(
        &router,
        Method::POST,
        "/v1/hustle/interviews/mock",
        Some(("Bearer", access)),
        Some(json!({"question_id": qid})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{mock_b}");
    assert_eq!(mock_b["text"], mock_a["text"]);

    let (status, suggest_a) = send(
        &router,
        Method::POST,
        "/v1/hustle/side-hustles/suggest",
        Some(("Bearer", access)),
        Some(json!({"skills": ["设计", "写作"], "hours_per_week": 6})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{suggest_a}");
    assert_eq!(suggest_a["source"], "mock");
    assert!(suggest_a["items"].as_array().unwrap().len() >= 2);
    assert!(suggest_a["items"][0]["estimated_income"].as_i64().unwrap() > 0);

    let (status, suggest_b) = send(
        &router,
        Method::POST,
        "/v1/hustle/side-hustles/suggest",
        Some(("Bearer", access)),
        Some(json!({"skills": ["写作", "设计"], "hours_per_week": 6})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{suggest_b}");
    assert_eq!(suggest_b["items"], suggest_a["items"]);
}

#[tokio::test]
async fn hustle_ai_uses_injected_gateway() {
    let mut state = AppState::connect(Config::test()).await.unwrap();
    state.ai = Arc::new(FixedGateway);
    let router = app(state);
    let created = register_user(&router, "gw-hustle@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();

    let (status, resume) = send(
        &router,
        Method::POST,
        "/v1/hustle/resumes",
        Some(("Bearer", access)),
        Some(json!({"content": {"name": "林轻心"}})),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{resume}");

    let (status, opt) = send(
        &router,
        Method::POST,
        &format!(
            "/v1/hustle/resumes/{}/optimize",
            resume["id"].as_str().unwrap()
        ),
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{opt}");
    assert_eq!(opt["source"], "gateway");
    assert_eq!(opt["text"], "gateway-sentence");
}

#[tokio::test]
async fn privacy_export_includes_hustle_and_delete_cascades() {
    let (router, state) = world().await;
    let created = register_user(&router, "keep-hustle@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();

    let (status, app_row) = send(
        &router,
        Method::POST,
        "/v1/hustle/applications",
        Some(("Bearer", access)),
        Some(json!({"company": "轻心实验室", "position": "前端"})),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{app_row}");
    let (status, resume) = send(
        &router,
        Method::POST,
        "/v1/hustle/resumes",
        Some(("Bearer", access)),
        Some(json!({"content": {"name": "林轻心"}})),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{resume}");
    let (status, hustle) = send(
        &router,
        Method::POST,
        "/v1/hustle/side-hustles",
        Some(("Bearer", access)),
        Some(json!({
            "title": "文档翻译",
            "platform": "线上",
            "estimated_income": 1200,
            "skills_required": ["英语"],
            "kind": "线上"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{hustle}");

    let (status, export) = send(
        &router,
        Method::GET,
        "/v1/privacy/export",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{export}");
    assert_eq!(export["applications"][0]["id"], app_row["id"]);
    assert_eq!(export["resumes"][0]["id"], resume["id"]);
    assert_eq!(export["side_hustles"][0]["id"], hustle["id"]);

    let (status, _) = send(
        &router,
        Method::DELETE,
        "/v1/privacy/account",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let apps: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM applications")
        .fetch_one(&state.pool)
        .await
        .unwrap();
    let resumes: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM resumes")
        .fetch_one(&state.pool)
        .await
        .unwrap();
    let sides: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM side_hustles")
        .fetch_one(&state.pool)
        .await
        .unwrap();
    assert_eq!(apps, 0);
    assert_eq!(resumes, 0);
    assert_eq!(sides, 0);
}

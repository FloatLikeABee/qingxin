use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
};
use qingxin_api::ai::{
    AiError, AiGateway, CompletionRequest, CompletionResponse, QingxinAiGateway,
    UnconfiguredAiGateway,
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
    let (status, _headers, bytes) = send_raw(router, method, uri, auth, body).await;
    if bytes.is_empty() {
        return (status, Value::Null);
    }
    let json = serde_json::from_slice(&bytes)
        .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&bytes).into_owned()));
    (status, json)
}

async fn send_raw(
    router: &axum::Router,
    method: Method,
    uri: &str,
    auth: Option<(&str, &str)>,
    body: Option<Value>,
) -> (StatusCode, axum::http::HeaderMap, axum::body::Bytes) {
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
    let headers = response.headers().clone();
    let bytes = axum::body::to_bytes(response.into_body(), 2 * 1024 * 1024)
        .await
        .unwrap();
    (status, headers, bytes)
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

fn sse_result(body: &str) -> Value {
    for block in body.split("\n\n") {
        if block.contains("event: result") {
            for line in block.lines() {
                if let Some(data) = line.strip_prefix("data: ") {
                    return serde_json::from_str(data).unwrap_or(Value::Null);
                }
            }
        }
    }
    panic!("no result event in {body}");
}

fn sse_text(body: &str) -> String {
    let mut out = String::new();
    for line in body.lines() {
        let Some(data) = line.strip_prefix("data: ") else {
            continue;
        };
        if data == "[DONE]" {
            continue;
        }
        if let Ok(value) = serde_json::from_str::<Value>(data) {
            if let Some(text) = value["choices"][0]["delta"]["content"].as_str() {
                out.push_str(text);
            }
        }
    }
    out
}

async fn run_tool(
    router: &axum::Router,
    token: &str,
    tool_id: &str,
    body: Value,
) -> (StatusCode, axum::http::HeaderMap, String) {
    let (status, headers, bytes) = send_raw(
        router,
        Method::POST,
        &format!("/v1/tools/{tool_id}/run"),
        Some(("Bearer", token)),
        Some(body),
    )
    .await;
    (
        status,
        headers,
        String::from_utf8_lossy(&bytes).into_owned(),
    )
}

struct CompleteOnlyGateway;

#[async_trait::async_trait]
impl AiGateway for CompleteOnlyGateway {
    async fn complete(
        &self,
        _user_id: &str,
        _req: CompletionRequest,
    ) -> Result<CompletionResponse, AiError> {
        Ok(CompletionResponse {
            content: "complete-only-sentence".into(),
            model: Some("fixed".into()),
            usage: None,
        })
    }
}

#[tokio::test]
async fn catalog_recent_favourites_and_auth() {
    let (router, _) = world().await;
    let (status, denied) = send(&router, Method::GET, "/v1/tools", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(denied["error"]["code"], "unauthenticated");

    let a = register_user(&router, "a-tools@qingxin.app").await;
    let token = a["access_token"].as_str().unwrap();
    let (status, catalog) = send(
        &router,
        Method::GET,
        "/v1/tools",
        Some(("Bearer", token)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{catalog}");
    let ids: Vec<&str> = catalog["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|item| item["id"].as_str().unwrap())
        .collect();
    assert_eq!(
        ids,
        vec![
            "summary",
            "meeting",
            "writing.weekly",
            "writing.daily",
            "writing.xhs",
            "polish",
            "resume_jd",
            "rename"
        ]
    );
    assert!(catalog["items"][0]["name"]
        .as_str()
        .unwrap()
        .contains("摘要"));
    assert_eq!(catalog["items"][0]["favourite"], false);

    let (status, _, polish_sse) =
        run_tool(&router, token, "polish", json!({ "text": "今天写周报" })).await;
    assert_eq!(status, StatusCode::OK, "{polish_sse}");
    let (status, _, summary_sse) = run_tool(
        &router,
        token,
        "summary",
        json!({ "input_kind": "text", "text": "买菜、回邮件、散步。" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{summary_sse}");

    let (status, catalog) = send(
        &router,
        Method::GET,
        "/v1/tools",
        Some(("Bearer", token)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{catalog}");
    let recent: Vec<&str> = catalog["recent"]
        .as_array()
        .unwrap()
        .iter()
        .map(|item| item.as_str().unwrap())
        .collect();
    assert_eq!(recent[0], "summary");
    assert!(recent.contains(&"polish"));

    let (status, fav) = send(
        &router,
        Method::PUT,
        "/v1/tools/meeting/favourite",
        Some(("Bearer", token)),
        Some(json!({ "favourite": true })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{fav}");
    assert_eq!(fav["favourite"], true);
    let (status, catalog) = send(
        &router,
        Method::GET,
        "/v1/tools",
        Some(("Bearer", token)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{catalog}");
    let favs: Vec<&str> = catalog["favourites"]
        .as_array()
        .unwrap()
        .iter()
        .map(|item| item.as_str().unwrap())
        .collect();
    assert!(favs.contains(&"meeting"));
    assert_eq!(
        catalog["items"]
            .as_array()
            .unwrap()
            .iter()
            .find(|item| item["id"] == "meeting")
            .unwrap()["favourite"],
        true
    );

    let (status, unfav) = send(
        &router,
        Method::PUT,
        "/v1/tools/meeting/favourite",
        Some(("Bearer", token)),
        Some(json!({ "favourite": false })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{unfav}");
    let (status, catalog) = send(
        &router,
        Method::GET,
        "/v1/tools",
        Some(("Bearer", token)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{catalog}");
    let favs: Vec<&str> = catalog["favourites"]
        .as_array()
        .unwrap()
        .iter()
        .map(|item| item.as_str().unwrap())
        .collect();
    assert!(!favs.contains(&"meeting"));
}

#[tokio::test]
async fn summary_sse_input_kinds_and_validation() {
    let (router, _) = world().await;
    let user = register_user(&router, "sum@qingxin.app").await;
    let token = user["access_token"].as_str().unwrap();

    let (status, headers, body) = run_tool(
        &router,
        token,
        "summary",
        json!({ "input_kind": "text", "text": "明天交周报，并回复客户邮件。" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(headers
        .get(header::CONTENT_TYPE)
        .unwrap()
        .to_str()
        .unwrap()
        .starts_with("text/event-stream"));
    assert!(body.contains("data:"));
    assert!(body.contains("event: result"));
    assert!(body.contains("[DONE]"));
    let result = sse_result(&body);
    assert_eq!(result["source"], "mock");
    assert!(result["disclaimer"].as_str().unwrap().contains("不构成"));
    assert!(!sse_text(&body).is_empty());
    assert!(!result["output_json"]["todos"]
        .as_array()
        .unwrap()
        .is_empty());
    assert!(
        result["output_text"].as_str().unwrap().contains("摘要")
            || !result["output_text"].as_str().unwrap().is_empty()
    );

    let (status, _, url_body) = run_tool(
        &router,
        token,
        "summary",
        json!({
            "input_kind": "url",
            "url": "https://example.com/notes",
            "text": "页面里写了开会和购物。"
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{url_body}");
    let url_result = sse_result(&url_body);
    assert_eq!(url_result["input_meta"]["url"], "https://example.com/notes");

    let (status, _, pdf_body) = run_tool(
        &router,
        token,
        "summary",
        json!({
            "input_kind": "pdf",
            "filename": "notes.pdf",
            "text": "%PDF-1.1\nBT (整理发票) Tj (回复邮件) Tj ET"
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{pdf_body}");
    let pdf_result = sse_result(&pdf_body);
    assert_eq!(pdf_result["input_meta"]["filename"], "notes.pdf");
    assert!(!pdf_result["output_json"]["todos"]
        .as_array()
        .unwrap()
        .is_empty());

    let (status, err) = send(
        &router,
        Method::POST,
        "/v1/tools/summary/run",
        Some(("Bearer", token)),
        Some(json!({ "input_kind": "text", "text": "   " })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{err}");
    assert_eq!(err["error"]["code"], "invalid_request");

    let (status, err) = send(
        &router,
        Method::POST,
        "/v1/tools/translate/run",
        Some(("Bearer", token)),
        Some(json!({ "text": "hi" })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{err}");
    assert_eq!(err["error"]["code"], "invalid_request");

    let too_long = "字".repeat(32001);
    let (status, err) = send(
        &router,
        Method::POST,
        "/v1/tools/summary/run",
        Some(("Bearer", token)),
        Some(json!({ "input_kind": "text", "text": too_long })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{err}");
    assert_eq!(err["error"]["code"], "invalid_request");
}

#[tokio::test]
async fn meeting_writing_polish_resume_and_rename() {
    let (router, _) = world().await;
    let user = register_user(&router, "suite@qingxin.app").await;
    let token = user["access_token"].as_str().unwrap();

    let (status, _, topics_body) = run_tool(
        &router,
        token,
        "meeting",
        json!({ "text": "Alice 决定下周一发布，Bob 负责测试。" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{topics_body}");
    let topics = sse_result(&topics_body);
    assert!(!topics["output_json"]["topics"]
        .as_array()
        .unwrap()
        .is_empty());

    let other = register_user(&router, "no-topics@qingxin.app").await;
    let other_tok = other["access_token"].as_str().unwrap();
    let (status, err) = send(
        &router,
        Method::POST,
        "/v1/tools/meeting/run",
        Some(("Bearer", other_tok)),
        Some(json!({ "step": "decisions", "text": "一段记录" })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{err}");
    assert_eq!(err["error"]["code"], "invalid_request");

    let (status, _, decisions_body) = run_tool(
        &router,
        token,
        "meeting",
        json!({ "step": "decisions", "text": "Alice 决定下周一发布，Bob 负责测试。" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{decisions_body}");
    let decisions = sse_result(&decisions_body);
    assert!(!decisions["output_json"]["topics"]
        .as_array()
        .unwrap()
        .is_empty());
    assert!(!decisions["output_json"]["decisions"]
        .as_array()
        .unwrap()
        .is_empty());

    for tool_id in ["writing.weekly", "writing.daily", "writing.xhs"] {
        let (status, _, body) = run_tool(
            &router,
            token,
            tool_id,
            json!({ "text": "本周上线了提醒功能，修了登录。" }),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{tool_id} {body}");
        let writing = sse_result(&body);
        let text = writing["output_text"].as_str().unwrap();
        assert!(!text.is_empty());
        if tool_id == "writing.weekly" {
            assert!(text.contains("周报"));
        }
    }

    let (status, _, polish_body) = run_tool(
        &router,
        token,
        "polish",
        json!({ "text": "今天写周报", "tone": "更幽默" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{polish_body}");
    assert!(!sse_result(&polish_body)["output_text"]
        .as_str()
        .unwrap()
        .is_empty());

    let (status, err) = send(
        &router,
        Method::POST,
        "/v1/tools/polish/run",
        Some(("Bearer", token)),
        Some(json!({ "text": "今天写周报", "tone": "更煽情" })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{err}");
    assert_eq!(err["error"]["code"], "invalid_request");

    let (status, _, match_body) = run_tool(
        &router,
        token,
        "resume_jd",
        json!({
            "resume": "熟悉 Rust 与前端，做过记账应用。",
            "jd": "招聘全栈，要求 Rust 与 TypeScript。"
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{match_body}");
    let matched = sse_result(&match_body);
    let score = matched["output_json"]["score"].as_i64().unwrap();
    assert!((0..=100).contains(&score));
    assert!(!matched["output_json"]["matches"]
        .as_array()
        .unwrap()
        .is_empty());
    assert!(matched["disclaimer"].as_str().unwrap().contains("不构成"));

    let (status, err) = send(
        &router,
        Method::POST,
        "/v1/tools/resume_jd/run",
        Some(("Bearer", token)),
        Some(json!({ "resume": "只有简历" })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{err}");
    assert_eq!(err["error"]["code"], "invalid_request");

    let (status, _, rename_body) = run_tool(
        &router,
        token,
        "rename",
        json!({ "filenames": ["会议 最终 final (1).docx", "IMG_0001.jpg"] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{rename_body}");
    let renamed = sse_result(&rename_body);
    let suggestions = renamed["output_json"]["suggestions"].as_array().unwrap();
    assert_eq!(suggestions.len(), 2);
    assert_ne!(suggestions[0]["suggested"], "会议 最终 final (1).docx");
}

#[tokio::test]
async fn gateway_mock_provider_and_complete_only_double() {
    let mut state = AppState::connect(Config::test()).await.unwrap();
    state.ai = Arc::new(QingxinAiGateway::mock("gateway-sentence"));
    let router = app(state);
    let user = register_user(&router, "gw@qingxin.app").await;
    let token = user["access_token"].as_str().unwrap();
    let (status, _, body) = run_tool(&router, token, "polish", json!({ "text": "草稿" })).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let result = sse_result(&body);
    assert_eq!(result["source"], "gateway");
    assert!(
        sse_text(&body).contains("gateway-sentence") || result["output_text"] == "gateway-sentence"
    );

    let mut state = AppState::connect(Config::test()).await.unwrap();
    state.ai = Arc::new(CompleteOnlyGateway);
    let router = app(state);
    let user = register_user(&router, "complete-only@qingxin.app").await;
    let token = user["access_token"].as_str().unwrap();
    let (status, _, body) = run_tool(&router, token, "polish", json!({ "text": "草稿" })).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(
        sse_text(&body).contains("complete-only-sentence")
            || sse_result(&body)["output_text"] == "complete-only-sentence"
    );
}

#[tokio::test]
async fn history_isolation_export_and_delete() {
    let (router, state) = world().await;
    let a = register_user(&router, "hist-a@qingxin.app").await;
    let b = register_user(&router, "hist-b@qingxin.app").await;
    let a_tok = a["access_token"].as_str().unwrap();
    let b_tok = b["access_token"].as_str().unwrap();

    let (status, _, polish) = run_tool(&router, a_tok, "polish", json!({ "text": "一" })).await;
    assert_eq!(status, StatusCode::OK, "{polish}");
    let (status, _, summary) = run_tool(
        &router,
        a_tok,
        "summary",
        json!({ "input_kind": "text", "text": "二，记得买奶。" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{summary}");
    let summary_id = sse_result(&summary)["id"].as_str().unwrap().to_string();

    let (status, _) = send(
        &router,
        Method::PUT,
        "/v1/tools/summary/favourite",
        Some(("Bearer", a_tok)),
        Some(json!({ "favourite": true })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let (status, list) = send(
        &router,
        Method::GET,
        "/v1/tools/tasks",
        Some(("Bearer", a_tok)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{list}");
    assert_eq!(list["items"][0]["tool_id"], "summary");
    assert_eq!(list["items"][0]["id"], summary_id);

    let (status, filtered) = send(
        &router,
        Method::GET,
        "/v1/tools/tasks?tool_id=meeting",
        Some(("Bearer", a_tok)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{filtered}");
    assert!(filtered["items"].as_array().unwrap().is_empty());

    let (status, b_list) = send(
        &router,
        Method::GET,
        "/v1/tools/tasks",
        Some(("Bearer", b_tok)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{b_list}");
    assert!(b_list["items"].as_array().unwrap().is_empty());

    let (status, hidden) = send(
        &router,
        Method::GET,
        &format!("/v1/tools/tasks/{summary_id}"),
        Some(("Bearer", b_tok)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{hidden}");

    let (status, export) = send(
        &router,
        Method::GET,
        "/v1/privacy/export",
        Some(("Bearer", a_tok)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{export}");
    assert!(export["ai_tasks"]
        .as_array()
        .unwrap()
        .iter()
        .any(|item| item["id"] == summary_id));
    assert!(export["templates"]
        .as_array()
        .unwrap()
        .iter()
        .any(|item| item["tool_id"] == "summary"));

    let (status, _) = send(
        &router,
        Method::DELETE,
        "/v1/privacy/account",
        Some(("Bearer", a_tok)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let tasks: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM ai_tasks WHERE user_id = ?")
        .bind(a["user"]["id"].as_str().unwrap())
        .fetch_one(&state.pool)
        .await
        .unwrap();
    let templates: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM templates WHERE user_id = ?")
        .bind(a["user"]["id"].as_str().unwrap())
        .fetch_one(&state.pool)
        .await
        .unwrap();
    assert_eq!(tasks, 0);
    assert_eq!(templates, 0);
}

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

struct FailingGateway;

#[async_trait::async_trait]
impl AiGateway for FailingGateway {
    async fn complete(
        &self,
        _user_id: &str,
        _req: CompletionRequest,
    ) -> Result<CompletionResponse, AiError> {
        Err(AiError::Failed("connection refused".into()))
    }
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
async fn creation_create_list_patch_isolation_and_validation() {
    let (router, _) = world().await;
    let a = register_user(&router, "a-create@qingxin.app").await;
    let b = register_user(&router, "b-create@qingxin.app").await;
    let a_tok = a["access_token"].as_str().unwrap();
    let b_tok = b["access_token"].as_str().unwrap();

    let (status, denied) = send(
        &router,
        Method::POST,
        "/v1/create/creations",
        None,
        Some(json!({
            "platform": "小红书",
            "prompt_params": { "topic": "阳台种菜" },
            "generated_content": "第一稿"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(denied["error"]["code"], "unauthenticated");

    let (status, first) = send(
        &router,
        Method::POST,
        "/v1/create/creations",
        Some(("Bearer", a_tok)),
        Some(json!({
            "platform": "小红书",
            "prompt_params": { "topic": "阳台种菜", "tone": "更专业", "length": "短" },
            "generated_content": "第一稿"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{first}");
    assert_eq!(first["platform"], "小红书");
    assert_eq!(first["final_content"], "第一稿");
    assert_eq!(first["versions"].as_array().unwrap().len(), 1);

    let (status, polished_create) = send(
        &router,
        Method::POST,
        "/v1/create/creations",
        Some(("Bearer", a_tok)),
        Some(json!({
            "platform": "公众号",
            "prompt_params": { "topic": "午睡十分钟" },
            "generated_content": "第一稿",
            "final_content": "润色稿"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{polished_create}");
    assert_eq!(polished_create["final_content"], "润色稿");
    assert_eq!(polished_create["versions"].as_array().unwrap().len(), 2);

    let id = first["id"].as_str().unwrap();
    let (status, again) = send(
        &router,
        Method::POST,
        "/v1/create/creations",
        Some(("Bearer", a_tok)),
        Some(json!({
            "id": id,
            "platform": "小红书",
            "prompt_params": { "topic": "阳台种菜" },
            "generated_content": "另一稿"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{again}");
    assert_eq!(again["id"], id);
    assert_eq!(again["generated_content"], "第一稿");

    let (status, bad) = send(
        &router,
        Method::POST,
        "/v1/create/creations",
        Some(("Bearer", a_tok)),
        Some(json!({
            "platform": "微博",
            "prompt_params": { "topic": "x" },
            "generated_content": "稿"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(bad["error"]["code"], "invalid_request");

    let (status, empty) = send(
        &router,
        Method::POST,
        "/v1/create/creations",
        Some(("Bearer", a_tok)),
        Some(json!({
            "platform": "小红书",
            "prompt_params": { "topic": "x" },
            "generated_content": "  "
        })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(empty["error"]["code"], "invalid_request");

    let (status, patched) = send(
        &router,
        Method::PATCH,
        &format!("/v1/create/creations/{id}"),
        Some(("Bearer", a_tok)),
        Some(json!({ "final_content": "定稿" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{patched}");
    assert_eq!(patched["final_content"], "定稿");
    assert!(patched["versions"].as_array().unwrap().len() > 1);
    let version_count = patched["versions"].as_array().unwrap().len();
    let (status, same) = send(
        &router,
        Method::PATCH,
        &format!("/v1/create/creations/{id}"),
        Some(("Bearer", a_tok)),
        Some(json!({ "final_content": "定稿" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{same}");
    assert_eq!(same["versions"].as_array().unwrap().len(), version_count);

    let (status, listed) = send(
        &router,
        Method::GET,
        "/v1/create/creations",
        Some(("Bearer", b_tok)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{listed}");
    assert!(listed["items"].as_array().unwrap().is_empty());

    let (status, hidden) = send(
        &router,
        Method::GET,
        &format!("/v1/create/creations/{id}"),
        Some(("Bearer", b_tok)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(hidden["error"]["code"], "not_found");
}

#[tokio::test]
async fn snippets_crud_use_isolation_and_validation() {
    let (router, _) = world().await;
    let a = register_user(&router, "a-snip@qingxin.app").await;
    let b = register_user(&router, "b-snip@qingxin.app").await;
    let a_tok = a["access_token"].as_str().unwrap();
    let b_tok = b["access_token"].as_str().unwrap();

    let (status, denied) = send(&router, Method::GET, "/v1/create/snippets", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(denied["error"]["code"], "unauthenticated");

    let (status, created) = send(
        &router,
        Method::POST,
        "/v1/create/snippets",
        Some(("Bearer", a_tok)),
        Some(json!({
            "content": "把结论写在第一句。",
            "kind": "金句",
            "tags": ["开头"]
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    assert_eq!(created["content"], "把结论写在第一句。");
    assert_eq!(created["kind"], "金句");
    assert_eq!(created["usage_count"], 0);
    assert_eq!(created["tags"][0], "开头");

    let (status, blank) = send(
        &router,
        Method::POST,
        "/v1/create/snippets",
        Some(("Bearer", a_tok)),
        Some(json!({ "content": "  " })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(blank["error"]["code"], "invalid_request");

    let (status, kind) = send(
        &router,
        Method::POST,
        "/v1/create/snippets",
        Some(("Bearer", a_tok)),
        Some(json!({ "content": "例子", "kind": "段子" })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(kind["error"]["code"], "invalid_request");

    let id = created["id"].as_str().unwrap();
    let (status, used) = send(
        &router,
        Method::POST,
        &format!("/v1/create/snippets/{id}/use"),
        Some(("Bearer", a_tok)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{used}");
    assert_eq!(used["usage_count"], 1);

    let (status, listed) = send(
        &router,
        Method::GET,
        "/v1/create/snippets",
        Some(("Bearer", b_tok)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{listed}");
    assert!(listed["items"].as_array().unwrap().is_empty());

    let (status, steal) = send(
        &router,
        Method::POST,
        &format!("/v1/create/snippets/{id}/use"),
        Some(("Bearer", b_tok)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(steal["error"]["code"], "not_found");
}

#[tokio::test]
async fn templates_catalog_and_platform_filter() {
    let (router, _) = world().await;
    let a = register_user(&router, "tpl@qingxin.app").await;
    let access = a["access_token"].as_str().unwrap();

    let (status, all) = send(
        &router,
        Method::GET,
        "/v1/create/templates",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{all}");
    let items = all["items"].as_array().unwrap();
    let platforms: Vec<&str> = items
        .iter()
        .map(|item| item["platform"].as_str().unwrap())
        .collect();
    for needed in ["小红书", "公众号", "抖音", "周报"] {
        assert!(platforms.contains(&needed), "{all}");
    }

    let (status, filtered) = send(
        &router,
        Method::GET,
        "/v1/create/templates?platform=%E5%B0%8F%E7%BA%A2%E4%B9%A6",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{filtered}");
    for item in filtered["items"].as_array().unwrap() {
        assert_eq!(item["platform"], "小红书");
    }

    let (status, bad) = send(
        &router,
        Method::GET,
        "/v1/create/templates?platform=%E5%BE%AE%E5%8D%9A",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(bad["error"]["code"], "invalid_request");
}

#[tokio::test]
async fn ai_generate_titles_polish_outline_mock_and_gateway() {
    let (router, mut state) = world().await;
    let created = register_user(&router, "ai-create@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();

    let (status, gen) = send(
        &router,
        Method::POST,
        "/v1/create/generate",
        Some(("Bearer", access)),
        Some(json!({
            "platform": "小红书",
            "topic": "阳台种菜",
            "keywords": ["番茄", "阳光"],
            "tone": "更幽默",
            "length": "短"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{gen}");
    assert_eq!(gen["source"], "mock");
    assert!(gen["text"].as_str().unwrap().contains("阳台种菜"));
    assert!(gen["disclaimer"].as_str().unwrap().contains("不构成"));

    let (status, titles) = send(
        &router,
        Method::POST,
        "/v1/create/titles",
        Some(("Bearer", access)),
        Some(json!({ "topic": "阳台种菜", "platform": "小红书" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{titles}");
    assert_eq!(titles["source"], "mock");
    assert_eq!(titles["titles"].as_array().unwrap().len(), 10);
    assert!(titles["titles"]
        .as_array()
        .unwrap()
        .iter()
        .all(|item| item.as_str().map(|s| !s.is_empty()).unwrap_or(false)));

    let (status, polish) = send(
        &router,
        Method::POST,
        "/v1/create/polish",
        Some(("Bearer", access)),
        Some(json!({ "text": "今天写周报", "tone": "更幽默" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{polish}");
    assert_eq!(polish["source"], "mock");
    assert_ne!(polish["text"], "今天写周报");
    assert!(polish["text"].as_str().unwrap().contains("今天写周报"));

    let (status, outline) = send(
        &router,
        Method::POST,
        "/v1/create/outline",
        Some(("Bearer", access)),
        Some(json!({ "topic": "季度复盘" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{outline}");
    assert_eq!(outline["source"], "mock");
    assert!(outline["slides"].as_array().unwrap().len() >= 3);
    assert!(outline["markdown"].as_str().unwrap().contains("季度复盘"));
    assert!(outline["disclaimer"].as_str().unwrap().contains("不构成"));

    let (status, bad_platform) = send(
        &router,
        Method::POST,
        "/v1/create/generate",
        Some(("Bearer", access)),
        Some(json!({ "platform": "微博", "topic": "x" })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(bad_platform["error"]["code"], "invalid_request");

    let (status, bad_tone) = send(
        &router,
        Method::POST,
        "/v1/create/polish",
        Some(("Bearer", access)),
        Some(json!({ "text": "今天写周报", "tone": "更煽情" })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(bad_tone["error"]["code"], "invalid_request");

    state.ai = Arc::new(FixedGateway);
    let router = app(state);

    let (status, gated) = send(
        &router,
        Method::POST,
        "/v1/create/generate",
        Some(("Bearer", access)),
        Some(json!({ "platform": "公众号", "topic": "午睡" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{gated}");
    assert_eq!(gated["source"], "gateway");
    assert_eq!(gated["text"], "gateway-sentence");

    let (status, gated_titles) = send(
        &router,
        Method::POST,
        "/v1/create/titles",
        Some(("Bearer", access)),
        Some(json!({ "topic": "午睡" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{gated_titles}");
    assert_eq!(gated_titles["source"], "gateway");
    assert_eq!(gated_titles["titles"].as_array().unwrap().len(), 10);
    assert_eq!(gated_titles["titles"][0], "gateway-sentence");

    let (status, gated_outline) = send(
        &router,
        Method::POST,
        "/v1/create/outline",
        Some(("Bearer", access)),
        Some(json!({ "topic": "午睡" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{gated_outline}");
    assert_eq!(gated_outline["source"], "gateway");
    assert_eq!(gated_outline["title"], "gateway-sentence");
}

#[tokio::test]
async fn generate_falls_back_to_stub_when_gateway_provider_fails() {
    let (router, mut state) = world().await;
    let created = register_user(&router, "fail-create@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();
    state.ai = Arc::new(FailingGateway);
    let router = app(state);

    let (status, gen) = send(
        &router,
        Method::POST,
        "/v1/create/generate",
        Some(("Bearer", access)),
        Some(json!({
            "platform": "小红书",
            "topic": "阳台种菜",
            "keywords": ["番茄"],
            "tone": "更专业",
            "length": "短"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{gen}");
    assert_ne!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(gen["source"], "mock");
    let text = gen["text"].as_str().unwrap();
    assert!(text.contains("阳台种菜"), "{text}");
    assert!(text.contains("示意文案"), "{text}");
    assert!(gen["disclaimer"].as_str().unwrap().contains("不构成"));
}

#[tokio::test]
async fn privacy_export_includes_create_and_delete_cascades() {
    let (router, state) = world().await;
    let created = register_user(&router, "keep-create@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();

    let (status, work) = send(
        &router,
        Method::POST,
        "/v1/create/creations",
        Some(("Bearer", access)),
        Some(json!({
            "platform": "周报",
            "prompt_params": { "topic": "本周进展" },
            "generated_content": "进展一览"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{work}");

    let (status, snip) = send(
        &router,
        Method::POST,
        "/v1/create/snippets",
        Some(("Bearer", access)),
        Some(json!({ "content": "先写结论。", "kind": "过渡" })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{snip}");

    let (status, export) = send(
        &router,
        Method::GET,
        "/v1/privacy/export",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{export}");
    assert_eq!(export["creations"][0]["id"], work["id"]);
    assert_eq!(export["snippets"][0]["id"], snip["id"]);

    let (status, _) = send(
        &router,
        Method::DELETE,
        "/v1/privacy/account",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let works: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM creations")
        .fetch_one(&state.pool)
        .await
        .unwrap();
    let snips: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM snippets")
        .fetch_one(&state.pool)
        .await
        .unwrap();
    assert_eq!(works, 0);
    assert_eq!(snips, 0);
}

//! Config, provider adapters, and secret redaction. No network.

use qingxin_ai_gateway::{
    ChatMessage, Gateway, GatewayConfig, OpenAiCompat, ProviderRequest, Role, SecretString,
    VendorConfig,
};

fn dashscope_key(get: impl Fn(&str) -> Option<String>) -> GatewayConfig {
    GatewayConfig::from_vars(get)
}

#[test]
fn default_chain_prefers_ollama_and_omits_keyless_vendors() {
    let config = GatewayConfig::from_vars(|_| None);
    let ids: Vec<_> = config
        .provider_ids()
        .into_iter()
        .map(|id| id.as_str().to_string())
        .collect();
    assert_eq!(ids.first().map(String::as_str), Some("ollama"));
    assert!(!ids.iter().any(|id| id == "dashscope"));
    assert!(!ids.iter().any(|id| id == "zhipu"));
    assert!(!ids.iter().any(|id| id == "kimi"));

    let gateway = Gateway::from_config(config);
    let live: Vec<_> = gateway
        .provider_ids()
        .into_iter()
        .map(|id| id.as_str().to_string())
        .collect();
    assert_eq!(live, vec!["ollama".to_string()]);
}

#[test]
fn vendor_keys_enable_dashscope_zhipu_and_kimi() {
    let config = GatewayConfig::from_vars(|key| match key {
        "DASHSCOPE_API_KEY" => Some("sk-ds".into()),
        "ZHIPU_API_KEY" => Some("sk-zp".into()),
        "KIMI_API_KEY" => Some("sk-km".into()),
        _ => None,
    });
    let ids: Vec<_> = config
        .provider_ids()
        .into_iter()
        .map(|id| id.as_str().to_string())
        .collect();
    assert_eq!(ids, vec!["ollama", "dashscope", "zhipu", "kimi"]);
}

#[test]
fn debug_redacts_api_keys() {
    let config = dashscope_key(|key| {
        if key == "DASHSCOPE_API_KEY" {
            Some("sk-secret-test".into())
        } else {
            None
        }
    });
    let rendered = format!("{config:?}");
    assert!(
        !rendered.contains("sk-secret-test"),
        "leaked secret: {rendered}"
    );
    assert!(rendered.contains("dashscope") || rendered.contains("VendorConfig"));
}

#[test]
fn secret_string_debug_is_redacted() {
    let secret = SecretString::new("sk-secret-test");
    assert!(!format!("{secret:?}").contains("sk-secret-test"));
    assert!(!format!("{secret}").contains("sk-secret-test"));
}

#[tokio::test]
async fn forge_complete_for_user_maps_openapi_shape() {
    use qingxin_ai_gateway::forge::{AiGateway, ChatMessage, CompletionRequest, ForgeGateway};
    use qingxin_ai_gateway::{Gateway, MockProvider};

    let mock = MockProvider::named("mock").text("forge-ok").usage(2, 1);
    let gw = Gateway::builder().provider(mock).build();
    let request = CompletionRequest {
        messages: vec![ChatMessage {
            role: "user".into(),
            content: "hi".into(),
        }],
        model: None,
    };
    let done = gw
        .complete_for_user("user-42", request.clone())
        .await
        .expect("forge map");
    assert_eq!(done.content, "forge-ok");
    assert_eq!(done.usage.unwrap().prompt_tokens, 2);

    let wrapped = ForgeGateway::new(
        Gateway::builder()
            .provider(MockProvider::named("m").text("anon"))
            .build(),
    );
    let anon = wrapped.complete(request).await.expect("anon");
    assert_eq!(anon.content, "anon");
}

#[test]
fn dashscope_builds_openai_compatible_request() {
    let adapter = OpenAiCompat::dashscope(VendorConfig {
        base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1".into(),
        api_key: Some(SecretString::new("sk-secret-test")),
        model: "qwen-plus".into(),
    });
    let built = adapter.build_request(&ProviderRequest {
        messages: vec![ChatMessage {
            role: Role::User,
            content: "hi".into(),
        }],
        model: None,
    });
    assert!(
        built.url.ends_with("/chat/completions"),
        "url was {}",
        built.url
    );
    assert!(built.url.contains("compatible-mode"));
    let debug = format!("{built:?}");
    assert!(!debug.contains("sk-secret-test"), "leaked: {debug}");
}

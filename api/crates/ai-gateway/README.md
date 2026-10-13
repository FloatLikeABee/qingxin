# qingxin-ai-gateway

Rust library crate for Qingxin (轻心) chat completions. Forge's Axum API
should depend on the [`Ai`](src/ai.rs) trait and hold a `Gateway` (or any
other `Ai` impl) on application state.

This crate does **not** bind a port and ships **no** cloud deploy files.

## Providers

Fallback order from `GatewayConfig::from_env()`:

1. `ollama` (default, no key) — `http://127.0.0.1:11434/v1`
2. `dashscope` — if `DASHSCOPE_API_KEY` is set
3. `zhipu` — if `ZHIPU_API_KEY` or `ZHIPUAI_API_KEY` is set
4. `kimi` — if `MOONSHOT_API_KEY` or `KIMI_API_KEY` is set

`MockProvider` is test-only and is never inserted by `from_env`.

## Environment

| Variable | Purpose |
|---|---|
| `OLLAMA_BASE_URL` | OpenAI-compatible Ollama base (default `http://127.0.0.1:11434/v1`) |
| `OLLAMA_MODEL` | Default `qwen2.5` |
| `DASHSCOPE_API_KEY` | Enables DashScope / Qwen |
| `DASHSCOPE_BASE_URL` | Default Aliyun compatible-mode `/v1` |
| `ZHIPU_API_KEY` | Enables Zhipu |
| `KIMI_API_KEY` / `MOONSHOT_API_KEY` | Enables Kimi |
| `QINGXIN_AI_TIMEOUT_MS` | Per-provider timeout (default 30000) |
| `QINGXIN_AI_RATE_LIMIT_RPM` | Per-user requests / 60s (default 30) |
| `QINGXIN_AI_SEMANTIC_THRESHOLD` | Cosine threshold (default 0.92) |

Never commit real keys. Config `Debug` prints `[redacted]`.

## Hookup

`api/` is a workspace. `AppState` holds `QingxinAiGateway` (Ollama from env;
other vendors only when their keys are set). `POST /v1/ai/complete` calls
`Gateway::complete_for_user(&user.user_id, body)` through that wrapper.

## Tests

```bash
cargo test
cargo clippy -- -D warnings
```

All default tests use `MockProvider` (no network, no keys).

# qingxin

轻心（Qingxin）— a calm life toolkit.

- Frontend shell: [`web/`](web/) (SvelteKit PWA)
- Foundation API: [`api/`](api/) (Axum + SQLx/SQLite)
- HTTP contract: [`api/openapi.yaml`](api/openapi.yaml)
- AI gateway: [`api/crates/ai-gateway`](api/crates/ai-gateway) (issue #3)

Issue tracker: [T1 Foundation](https://github.com/FloatLikeABee/qingxin/issues/4), [T1 AI gateway](https://github.com/FloatLikeABee/qingxin/issues/3), [T2 frontend shell](https://github.com/FloatLikeABee/qingxin/issues/1), [M1 情绪日记+冥想](https://github.com/FloatLikeABee/qingxin/issues/9).

M1 lives at `/modules/mood` (web) and `/v1/mood/*` plus `/v1/meditation/*` (API). Diary notes use T1 AES-GCM. AI insight uses the `AiGateway` seam and falls back to a deterministic mock when the gateway is unconfigured.

## API

```bash
cd api
export JWT_SECRET='a-dev-secret-at-least-32-bytes-long'
export QINGXIN_DATA_KEY="$(openssl rand -hex 32)"
export QINGXIN_LOOKUP_KEY="$(openssl rand -hex 32)"
export QINGXIN_SMS_STUB=1
export DATABASE_URL='sqlite://qingxin.db?mode=rwc'
export PORT=8080
cargo run
```

The process binds `0.0.0.0:$PORT`. SQLite is for local/CI; the schema is Postgres-ready (TEXT ids and timestamps). Render's disk is ephemeral — use Postgres in production.

Default AI provider is local Ollama (`http://127.0.0.1:11434/v1`). DashScope, Zhipu, and Kimi are added only when their API keys are set in the environment. See [`api/crates/ai-gateway/README.md`](api/crates/ai-gateway/README.md).

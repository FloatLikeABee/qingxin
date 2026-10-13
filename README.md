# qingxin

轻心（Qingxin）— a calm life toolkit.

- Frontend shell: [`web/`](web/) (SvelteKit PWA)
- Foundation API: [`api/`](api/) (Axum + SQLx/SQLite)
- HTTP contract: [`api/openapi.yaml`](api/openapi.yaml)
- AI gateway: [`api/crates/ai-gateway`](api/crates/ai-gateway) (issue #3)

Issue tracker: [T1 Foundation](https://github.com/FloatLikeABee/qingxin/issues/4), [T1 AI gateway](https://github.com/FloatLikeABee/qingxin/issues/3), [T2 frontend shell](https://github.com/FloatLikeABee/qingxin/issues/1), [M1 情绪日记+冥想](https://github.com/FloatLikeABee/qingxin/issues/9), [M10 求职副业](https://github.com/FloatLikeABee/qingxin/issues/13), [M7 健康](https://github.com/FloatLikeABee/qingxin/issues/18), [M4 本地生活](https://github.com/FloatLikeABee/qingxin/issues/16), [M8 学习打卡](https://github.com/FloatLikeABee/qingxin/issues/19).

M1 lives at `/modules/mood` (web) and `/v1/mood/*` plus `/v1/meditation/*` (API). Diary notes use T1 AES-GCM. AI insight uses the `AiGateway` seam and falls back to a deterministic mock when the gateway is unconfigured.

M10 lives at `/modules/hustle` (web) and `/v1/hustle/*` (API). Resume optimize, mock interviewer, and side-hustle suggestions use the same `AiGateway` seam with a deterministic mock fallback. Resume A4 preview stays light in dark mode.

M4 lives at `/modules/local` (web) and `/v1/local/*` (API). The map provider is a `stub`/`osm` seam; CI and offline use the SVG stub so no paid keys are required. Demo services are seeded.

M8 lives at `/modules/study` (web) and `/v1/study/*` (API). Flashcard faces and note Markdown use T1 AES-GCM. Classify uses the `AiGateway` seam. The focus timer stays in the browser.

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

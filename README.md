# qingxin

轻心（Qingxin）— a calm life toolkit.

- Frontend shell: [`web/`](web/) (SvelteKit PWA)
- Foundation API: [`api/`](api/) (Axum + SQLx/SQLite)
- HTTP contract: [`api/openapi.yaml`](api/openapi.yaml)

Issue tracker: [T1 Foundation](https://github.com/FloatLikeABee/qingxin/issues/4), [T2 frontend shell](https://github.com/FloatLikeABee/qingxin/issues/1).

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

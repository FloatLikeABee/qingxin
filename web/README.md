# 轻心 web

SvelteKit + TypeScript (strict) + Tailwind PWA for Qingxin. UI is zh-CN.

Requires **Node.js >=22** (`package.json` `engines`).

```bash
cd web
npm ci
npm run dev
npm test
npm run check
npm run build
```

`getApi()` in `src/lib/api/client.ts` returns `HttpQingxinApi` when `PUBLIC_API_URL` is a non-empty origin (trailing slash stripped), otherwise `MockQingxinApi`. Screens import the factory, not the mock class. The HTTP client implements the full `QingxinApi` interface against `/v1` (auth/session, mood, local, create, hustle, toolbox SSE, export/delete).

```bash
# live API (build-time env; static adapter inlines PUBLIC_*)
PUBLIC_API_URL=http://127.0.0.1:8080 npm run dev
PUBLIC_API_URL=http://127.0.0.1:8080 npm run build

# mock E2E (default Playwright config ignores api.e2e.ts)
npm run test:e2e

# real-API E2E — start the Axum process first
PUBLIC_API_URL=http://127.0.0.1:8080 npm run test:e2e:api
```

Theme modes: 浅色 / 深色 / 跟随系统 / 仅夜间开启 (19:00–07:00).
The typed API client lives in `src/lib/api`. The mock matches `api/openapi.yaml` and stays the default when `PUBLIC_API_URL` is unset.
M1 情绪日记+冥想 lives at `/modules/mood`.
M10 求职副业 lives at `/modules/hustle`. Resume A4 preview is always light; kanban uses deeper dark shadows and highlighted status tags.
M4 本地生活 lives at `/modules/local`. The map provider defaults to an offline SVG stub so CI needs no paid keys.
M5 AI效率工具箱 lives at `/modules/ai`. The workbench streams output on the right; copy/export/retry sit under the result.

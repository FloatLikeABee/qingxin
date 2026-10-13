# 轻心 web

SvelteKit + TypeScript (strict) + Tailwind PWA for Qingxin. UI is zh-CN.

```bash
cd web
npm ci
npm run dev
npm test
npm run check
npm run build
```

Theme modes: 浅色 / 深色 / 跟随系统 / 仅夜间开启 (19:00–07:00).
The typed API client lives in `src/lib/api` with a mock that matches `api/openapi.yaml`.
M1 情绪日记+冥想 lives at `/modules/mood`.
M10 求职副业 lives at `/modules/hustle`. Resume A4 preview is always light; kanban uses deeper dark shadows and highlighted status tags.
M4 本地生活 lives at `/modules/local`. The map provider defaults to an offline SVG stub so CI needs no paid keys.
M5 AI效率工具箱 lives at `/modules/ai`. The workbench streams output on the right; copy/export/retry sit under the result.

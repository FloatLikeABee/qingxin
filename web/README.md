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

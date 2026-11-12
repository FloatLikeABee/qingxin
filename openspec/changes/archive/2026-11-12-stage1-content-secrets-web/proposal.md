# Proposal

## Why

Qingxin stays a Chinese PWA. Stage 1 makes Content the main product (create + official share to 小红书 / WeChat / Douyin), adds a private artistic Secrets mailbox, drops the Components product surface, and warms the bento palette without a purple-slide or Hallmark-catalog restyle. Games stay Stage 2.

## What Changes

- Keep SvelteKit + Axum. No native apps, no Xcode, no Render, no Oldpeople, no pricing.
- Nav: 首页 / 内容 / 模块 / 我的. Remove 组件 from nav and product CTAs. `/kit` may remain as an unlinked developer page.
- Content: keep studio; add official share (Web Share API, clipboard copy, Markdown/PPTX export). No unofficial/scraped APIs.
- Secrets: letter-in / letter-out mailbox board with AI replies. Consent required. AES-GCM at rest. Owner-only. Not a chat thread. Not public.
- Palette: keep Qingxin blue primary; richer canvas/orbs (coral, teal, gold). Still 轻心.
- Games: disabled 「即将到来」 only.

## Capabilities

### New Capabilities

- `content-share`: Platform-formatted packs + Web Share / clipboard / export.
- `secrets-mailbox`: Consented private letters and AI letter replies on a board.

### Modified Capabilities

- `app-shell`: Drop 组件; Content is a primary tab; Secrets is a real module.
- `theming`: Richer tokens; primary blue stays.
- `api-client`: Secrets methods on `QingxinApi` / mock / HTTP.
- `privacy`: Export and account delete cover secret letters.

## Impact

- `api/migrations/0012_secrets.sql`, `api/src/secrets.rs`, OpenAPI `/v1/secrets/*`.
- `web/src/lib/create/share.ts`, `web/src/lib/secrets/*`, `/modules/secrets` UI.
- Playwright: Content posting + Secrets mailbox; Home desktop/mobile screenshots.

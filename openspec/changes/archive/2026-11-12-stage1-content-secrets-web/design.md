# Design

## Context

Qingxin is a zh-CN SvelteKit 5 PWA with a bento AppShell. Content studio already generates 小红书 / 公众号 / 抖音 / 周报 drafts. There is no public third-party posting API that we may call. Secrets does not exist. `/kit` is a design-system catalog currently in primary nav.

## Goals / Non-Goals

**Goals**

- Content as the main product: write, preview, then share via official browser mechanisms.
- Secrets as an artistic mailbox: one letter out, one letter back, laid on a board.
- Richer color on the existing shell. Chinese UI. Mobile browser, not a native app.

**Non-goals**

- Games, iOS/Android, Render, Oldpeople, pricing.
- Unofficial Xiaohongshu/WeChat/Douyin clients, credential stuffing, ToS circumvention.
- Chat UI, public secret feeds, IndexedDB copies of secret bodies.

## Decisions

### D1 — Share path

**Chosen:** `navigator.share` when present; clipboard copy and file export otherwise. Format packs per platform (小红书 hashtags, 微信/公众号 article text, 抖音 caption).

**Rejected:** unofficial publisher APIs; deep-linking into undocumented creator endpoints.

### D2 — Secrets storage

**Chosen:** Authenticated only. AES-256-GCM for letter and reply bodies. Explicit consent boolean required on create. No localStorage/IndexedDB persistence of secret text. Privacy export includes decrypted owner copies. Account delete cascades.

**Rejected:** public board; chat history table; client-side plaintext cache.

### D3 — Secrets UI

**Chosen:** Cork/paper mailbox with envelope cards. Opening a letter shows paper, not bubbles. Isolated CSS so the rest of Qingxin stays bento-blue.

**Rejected:** messenger thread; Hallmark cream-serif takeover of the whole app; purple sample-slide theme.

### D4 — Nav

**Chosen:** Replace 组件 with 内容 (`/modules/create`). Secrets lives in 模块 and on Home.

### D5 — Palette

**Chosen:** Keep `#3B82F6` / `#60A5FA` primary. Tint the canvas (pale sky / deep navy) and add coral/teal/gold atmosphere orbs. Cards stay elevated white/navy.

## Risks

- Screenshot e2e still expects 求职概览 / 内容创作 / 轻心实验室.
- Secrets AI must not echo the full secret into logs or public copy.
- Do not persist secrets in the create IndexedDB outbox.

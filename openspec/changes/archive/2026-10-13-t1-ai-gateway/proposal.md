# Proposal

## Why

Qingxin’s API must call Chinese and local OpenAI-compatible models (DashScope/Qwen, Zhipu, Kimi, Ollama) behind one seam so modules can stream completions without each owning keys, fallback, cache, or quotas. Issue #3 (Echo) lands that gateway now, in parallel with Forge’s Axum skeleton (#4), which is not on `main` and has no open PR yet.

## What Changes

- Add a standalone Rust crate at `api/crates/ai-gateway` that defines the `Ai` seam trait (`complete` + `stream`) Forge’s skeleton can depend on.
- Support OpenAI-compatible providers: Ollama (default), DashScope/Qwen, Zhipu, and Kimi, plus an in-process mock provider for tests.
- Fail over to the next configured provider on error or timeout.
- Add an exact-match prompt cache and a semantic (“semantic-ish”) cache.
- Enforce per-user rate limits and record token usage per user and per request.
- Emit SSE-formatted chat chunks for streaming workbenches (M5).
- Load API keys only from environment or config; never commit or log secrets.
- Stay local-only: no cloud deploy manifests.

## Capabilities

### New Capabilities

- `ai-gateway`: The `Ai` seam, request/response types, sequential provider fallback, and SSE chunk encoding.
- `ai-providers`: OpenAI-compatible adapters for Ollama, DashScope, Zhipu, and Kimi, plus a scriptable mock provider.
- `ai-prompt-cache`: Exact-match cache plus a pluggable semantic cache used before a provider call.
- `ai-rate-limit`: Per-user request rate limiting with a typed rate-limit error.
- `ai-token-accounting`: Per-request usage on the response and a per-user in-memory ledger.
- `ai-secrets`: Keys and endpoints from env/config only; redacted debug; no committed secrets.

### Modified Capabilities

- None. Frontend `api-client` has no chat methods yet; this change does not alter it.

## Impact

- New crate `api/crates/ai-gateway` (package `qingxin-ai-gateway`). No `api/Cargo.toml` so Forge’s skeleton PR can own the `api/` package/workspace without a file clash.
- Path-filtered CI workflow for the crate only.
- Forge later adds the crate as a workspace member and injects `Gateway` (or any `Ai` impl) at the `ai` module seam. Rebase onto that PR after it merges.
- No Render/Netlify/Vercel deploy files. No change to `web/`.

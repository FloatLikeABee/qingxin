# Design

## Context

See proposal.md — Why. `main` has `web/` (SvelteKit) and OpenSpec only. There is no `api/` tree. Forge’s T1 skeleton (issue #4, cloud agent running) is not in an open PR; `git ls-remote` shows only `main` and the merged T2 branch. The frontend `QingxinApi` interface has session/auth/export methods and no chat methods. Notion’s overview calls the cache “semantic-ish” and names Ollama as a first-class local provider. Issue #4 will later expose an `ai` module seam and `api/openapi.yaml`; this crate must be dependable as a library without owning HTTP routes.

Checked against the tree (2026-10-13): no `design.txt` / `PLAN.md` in this repo; no Forge `Ai` trait to copy. The seam is defined here.

## Goals / Non-Goals

**Goals:**

- Ship a library crate Forge can `use qingxin_ai_gateway::Ai` from.
- Make every acceptance test pass with the mock provider, no sockets, no keys.
- Keep vendor keys out of git, logs, Debug, and error strings.
- Encode streams as OpenAI-compatible SSE so M5’s workbench can consume them later.

**Non-Goals:**

- Axum routes, JWT, SQLx, OpenAPI, or migrations (Forge / issue #4).
- Persisting cache or token ledgers to SQLite.
- Real embedding models or remote moderation.
- Hedged/parallel provider calls or same-provider retries.
- Cloud deploy, Render/Netlify/Vercel config.
- Changing `web/` or the TypeScript `QingxinApi`.
- Merging the PR.

## Decisions

### D1 — Crate layout

**Chosen:** Standalone crate at `api/crates/ai-gateway` (package `qingxin-ai-gateway`, rust-lib `qingxin_ai_gateway`). No `api/Cargo.toml` and no repo-root workspace. CI runs `cargo fmt --check`, `clippy -D warnings`, and `cargo test` with `working-directory: api/crates/ai-gateway`.

**Rejected:**

1. **Repo-root `ai-gateway/`** — keeps Forge’s `api/` untouched, but the issue and #4 both say the gateway belongs under `api/`. After rebase the crate would have to move.
2. **`api/src/ai/` inside a binary we scaffold** — would invent Forge’s package layout and fight their PR.
3. **Virtual workspace `api/Cargo.toml` now** — guaranteed merge conflict when Forge writes `api/Cargo.toml` as the Axum package.

**Hookup Forge should use (minimal, not done here):** add `crates/ai-gateway` to their workspace members and hold `Arc<dyn Ai>` on app state.

### D2 — The `Ai` seam

**Chosen:** One async trait:

```rust
#[async_trait]
pub trait Ai: Send + Sync {
    async fn complete(&self, request: ChatRequest) -> Result<ChatResponse, AiError>;
    async fn stream(&self, request: ChatRequest) -> Result<ChatStream, AiError>;
    async fn usage(&self, user_id: &UserId) -> TokenLedger;
}
```

`Gateway` implements it. `ChatStream` is a boxed stream of `Result<ChatChunk, AiError>` plus `encode_sse(&ChatChunk) -> String`.

**Rejected:**

1. **Separate `Completer` / `Streamer` traits** — Forge would need two injections for one product feature.
2. **Callback/`mpsc` only** — harder to test and to turn into SSE.
3. **Guess Forge’s exact module path (`api::ai::AiService`)** — their seam is not visible; a small `Ai` trait is the documented contract.

### D3 — Provider chain and fallback

**Chosen:** `Provider` trait (`id`, `chat`, `chat_stream`). Default chain: `ollama` then any of `dashscope`, `zhipu`, `kimi` that have a key (Ollama needs none). Sequential failover on `ProviderError` or a per-attempt timeout (`tokio::time::timeout`, default **30s**, overridable). 8s was rejected: a cold Ollama pull commonly exceeds that and would skip the local default and spend paid keys. No same-provider retry. Mid-stream errors after the first delta are **not** failed over (partial text would duplicate if we switched). `GatewayConfig::from_env()` never inserts `MockProvider`.

Default vendor endpoints (overridable):

| Id | Base URL | Key env | Default model |
|---|---|---|---|
| `ollama` | `http://127.0.0.1:11434/v1` | none | `qwen2.5` |
| `dashscope` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `DASHSCOPE_API_KEY` | `qwen-plus` |
| `zhipu` | `https://open.bigmodel.cn/api/paas/v4` | `ZHIPU_API_KEY` | `glm-4-flash` |
| `kimi` | `https://api.moonshot.cn/v1` | `MOONSHOT_API_KEY` or `KIMI_API_KEY` | `moonshot-v1-8k` |

Shared OpenAI-compat HTTP client for the four vendors; `MockProvider` implements `Provider` directly.

**Rejected:**

1. **Hedged parallel calls** — doubles token spend and makes accounting lie.
2. **Retry the same provider N times first** — the issue asks for fallback on error/timeout, not local retry.
3. **HTTP inside tests via wiremock** — acceptance requires no network; mock `Provider` is the test double.

### D4 — Prompt cache

**Chosen:** In-memory, process-local.

1. Exact key = SHA-256 of `model` + normalized messages (`role` + trimmed `content`).
2. On miss, embed the **full** concatenated conversation (`role` + content), not only the last user turn, so a reused user line in a different thread does not false-hit.
3. `LexicalEmbedder` builds an L2-normalized bag of lowercase word unigrams **and** character 3-grams. Word-only cosine of “Summarise the meeting notes” vs “Summarize the meeting notes” is ~0.75 and would miss a 0.92 threshold; char 3-grams pull that pair above 0.92 while “Write a poem about cats” stays far below. A later Ollama embedder can implement the same `Embedder` trait.
4. Only successful completions are stored. A successful `stream` that runs to the terminal event is stored too. Hits replay the stored text as deltas.

**Rejected:**

1. **Exact-only** — Notion and the issue both require semantic (or “semantic-ish”) cache.
2. **Always call a real embedding model** — breaks “no network, no keys”.
3. **SQLite/Redis cache** — persistence is Forge’s database; this crate must stay testable in isolation.

### D5 — Rate limiting

**Chosen:** Sliding window of timestamps per `user_id`, default 30 requests / 60s, injectable clock. Applied after validation and **before** provider I/O. Cache hits still consume a slot (they are user-visible answers). Distinct users do not share a bucket.

**Rejected:**

1. **`governor` crate** — fine in production, but an injectable clock and tiny surface are easier to prove in unit tests than wrapping `governor`’s quota types.
2. **Limit only provider misses** — a client could hammer complete and treat the cache as a free oracle; still a request.
3. **Global limit only** — would let one user starve others, contradicting “per-user”.

### D6 — Token accounting

**Chosen:** `TokenUsage { prompt_tokens, completion_tokens }` on every success and stream terminal. `TokenStore` accumulates per user: `request_count`, `prompt_tokens`, `completion_tokens`. Cache hits add the cached usage. If a vendor omits `usage`, estimate with a whitespace/CJK-aware counter (1 token ≈ 1 ASCII word or 1 CJK char) so the fields are never absent.

**Rejected:**

1. **Return usage only, no ledger** — the issue asks for accounting per user **and** per request.
2. **Write SQLite from this crate** — couples us to Forge’s migrations.
3. **tiktoken** — extra native/data dependency; estimates are enough for local MVP.

### D7 — Secrets and local-only

**Chosen:** `GatewayConfig::from_env()` / `from_values`. Keys live in `SecretString` whose `Debug`/`Display` print `[redacted]`. Tracing events log provider ids and status codes, never headers. `.env` is gitignored if added; no sample file contains a real key. No cloud deploy files.

**Rejected:**

1. **Hardcoded demo keys** — forbidden by the issue.
2. **Render/Netlify blueprints for a gateway service** — “local-only”.

### D8 — Dependencies

**Chosen:** `tokio` (rt, time, macros, sync), `async-trait`, `futures`, `serde`/`serde_json`, `thiserror`, `sha2`, `reqwest` (rustls, json; used only by HTTP adapters), `tracing`. No Axum in this crate.

**Rejected:**

1. **Axum here so SSE is “real HTTP”** — Forge owns the server; we give them frames.
2. **`async-openai` crate** — heavier, less control over which headers we refuse to log.

## Self-grill (proposer vs reviewer)

Played both sides against the actual tree (no `api/`, no Forge trait, frontend API has no chat).

### Challenge 1 — “Forge will have a seam we should match”

**Skeptic:** Defining `Ai` now will drift from Forge’s `api::ai` module.

**Answer:** Their PR is not visible. The issue says “implements (or defines) the `ai` seam”. We define a small trait and document the hookup. We do not create a fake `api/src/ai.rs` that they would have to delete. If their trait appears before we merge, we add a one-file `impl Ai for TheirType` or rename — not a rewrite.

### Challenge 2 — “Rate-limit cache hits?”

**Skeptic:** Cache hits are cheap; counting them punishes repeat reads.

**Answer:** Spec `ai-rate-limit` counts complete/stream **attempts**. A generous default (30/min) still allows interactive use. Not counting hits invites a tight loop. Recorded in D5.

### Challenge 3 — “Mid-stream fallback”

**Skeptic:** Users hate a hung stream. Why not switch providers after the first token?

**Answer:** The client would already have painted prefix tokens from provider A. Starting provider B would either drop them (broken UX) or concatenate two models (nonsense). Failover only before the first delta. Documented in D3.

### Challenge 4 — “Lexical embedder is not semantic”

**Skeptic:** Bag-of-words will miss paraphrases and false-hit lexical cousins.

**Answer:** Notion says “semantic-ish”. The `Embedder` trait is the extension point. Tests pin “Summarise/Summarize” (same stems after a light normalize) vs “poem about cats”. Threshold 0.92 is conservative. A real embedder can land later without changing the seam.

### Challenge 5 — “Should this crate listen on 0.0.0.0:$PORT?”

**Skeptic:** Workspace Render rules say bind HTTP to `0.0.0.0:$PORT`.

**Answer:** This crate is not an HTTP server. Binding a port would violate “don’t invent Forge’s API” and “local-only / no cloud deploy”. No bind.

### Challenge 6 — “8s timeout vs cold Ollama”

**Skeptic:** First Ollama load can take tens of seconds. A short timeout makes the advertised default provider fail every cold start and bills DashScope.

**Answer:** Default timeout is 30s, not 8s, and is per-attempt / overridable. Still fallback if Ollama is actually down.

### Challenge 7 — “The semantic example cannot hit 0.92 with bag-of-words”

**Skeptic:** “Summarise…” vs “Summarize…” shares 3 of 4 words (cosine 0.75). The spec scenario is unimplementable with word unigrams at 0.92.

**Answer:** Verified with a quick count before locking D4. Character 3-grams plus word unigrams lift that pair over 0.92 without accepting “poem about cats”. Task 3.5 stays; add an embedder unit test that asserts both pairs.

### Challenge 8 — “Cache only last user message”

**Skeptic:** Embedding only the latest user turn would treat two different threads that happen to ask “ok?” as the same prompt.

**Answer:** Embed the full normalized conversation. Exact key already includes the full list.

## Failure modes

| Mode | What a user/dev gets | Guard |
|---|---|---|
| All providers down | Aggregated `AiError::AllProvidersFailed`, no panic, no secrets | Spec `ai-gateway` |
| Provider hangs | Per-attempt timeout, then next provider | D3 |
| Mid-stream drop | Stream error after whatever deltas were sent; no silent switch | D3 |
| Semantic false positive | Wrong cached answer | High threshold + exact-first; dissimilar-prompt test |
| Error cached | Sticky failure | Only store successes |
| Key in logs | Credential leak | `SecretString` + redaction test |
| Shared rate bucket | One user blocks others | Per-`user_id` map + isolation test |
| Cache hit omitted from ledger | Under-count | Cache-hit accounting test |
| Empty messages | Wasted provider call | Reject before I/O |
| Concurrent same-user requests | Lost increments / limit bypass | `tokio::sync::Mutex` on limiter, cache, ledger |
| DashScope URL wrong | 404 in production | Compatible-mode `/v1` + `/chat/completions` unit assertion on the adapter’s built request |
| Forge merge conflict on `api/Cargo.toml` | Blocked rebase | We never write that file |

## Risks / Trade-offs

- **[Risk] Forge names the trait differently** → Mitigation: trait is 3 methods; adapter impl is a dozen lines. Do not pre-create `api/src`.
- **[Risk] Lexical semantic cache misfires** → Mitigation: threshold 0.92, exact key first, embedder is swappable.
- **[Risk] In-memory cache/ledger vanish on process restart** → Mitigation: accepted; persistence is #4.
- **[Risk] `reqwest` in a library pulls HTTP even for mock tests** → Mitigation: tests never build the HTTP client; mock implements `Provider`.
- **[Risk] Token estimate disagrees with vendors** → Mitigation: prefer vendor `usage` when present; estimate is a fallback only.
- **[Risk] Path-filtered crate CI vs Forge’s later `qingxin.yml`** → Mitigation: keep this workflow narrowly filtered; they can subsume it.

## Migration Plan

1. Land the crate on a feature branch. Forge adds `crates/ai-gateway` as a workspace member after #4 merges; we rebase as the issue asks.
2. Rollback: revert the branch. No data stores to unwind.
3. When a real embedder exists, pass it into `Gateway::new`; no API break.

## Open Questions

None that change specs, approach, or tasks. Default RPM (30/60s), timeout (30s), and semantic threshold (0.92) are builder defaults, overridable in config.

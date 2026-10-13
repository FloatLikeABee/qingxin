# Tasks

## 1. Crate scaffold and Ai seam

- [ ] 1.1 Create `api/crates/ai-gateway` with package `qingxin-ai-gateway`, edition 2021, and verify `cargo test` in that directory starts (zero tests is OK)
- [ ] 1.2 Write a failing test that `Gateway` implements `Ai` and `complete` returns mock text plus usage, and verify it fails because the seam is missing
- [ ] 1.3 Implement `Ai`, `ChatRequest`/`ChatResponse`, `AiError`, and a `Gateway` that calls a single `MockProvider`, and verify the complete test passes
- [ ] 1.4 Write a failing test that empty messages or an empty user id return `InvalidRequest` without invoking the mock, and verify it fails
- [ ] 1.5 Reject invalid requests before provider I/O and verify the invalid-request test passes

## 2. Fallback

- [ ] 2.1 Write a failing test that a first mock error plus a second mock success returns the second text and provider id, and verify it fails
- [ ] 2.2 Implement sequential failover and verify the error-fallback test passes
- [ ] 2.3 Write a failing test that a first mock exceeding the timeout falls through to the next provider, and verify it fails
- [ ] 2.4 Apply a per-attempt timeout and verify the timeout-fallback test passes
- [ ] 2.5 Write a failing test that two failing mocks yield `AllProvidersFailed` without secret material, and verify it fails
- [ ] 2.6 Return the aggregated error and verify the all-failed test passes

## 3. Prompt cache

- [ ] 3.1 Write a failing test that a second identical complete is an exact hit and does not increment the mock call count, and verify it fails
- [ ] 3.2 Implement the exact-match cache (successes only) and verify the exact-hit test passes
- [ ] 3.3 Write a failing test that a failed first call is not reused when the mock later succeeds, and verify it fails
- [ ] 3.4 Skip caching errors and verify the no-cache-on-error test passes
- [ ] 3.5 Write a failing test that "Summarise the meeting notes" then "Summarize the meeting notes" is a semantic hit, and verify it fails
- [ ] 3.6 Implement `LexicalEmbedder` + cosine semantic cache and verify the semantic-hit test passes
- [ ] 3.7 Write a failing test that `LexicalEmbedder` cosine("Summarise the meeting notes", "Summarize the meeting notes") ≥ 0.92 and cosine vs "Write a poem about cats" < 0.92, plus a gateway test that the dissimilar prompt misses, and verify they fail
- [ ] 3.8 Implement the miss path and embedder assertions and verify those tests pass

## 4. Rate limiting

- [ ] 4.1 Write a failing test that a 2/60s limit rejects the third complete for the same user without calling the mock, and verify it fails
- [ ] 4.2 Implement the sliding-window limiter with an injectable clock and verify the excess-request test passes
- [ ] 4.3 Write a failing test that a different user is not blocked when the first user is at the limit, and verify it fails
- [ ] 4.4 Key buckets by user id and verify the isolation test passes

## 5. SSE streaming

- [ ] 5.1 Write a failing test that `stream` yields scripted mock deltas then a terminal usage event, and verify it fails
- [ ] 5.2 Implement `stream` + `ChatChunk` and verify the delta test passes
- [ ] 5.3 Write a failing test that `encode_sse` wraps a delta as `data: {json}` and the terminal as `data: [DONE]`, and verify it fails
- [ ] 5.4 Implement SSE encoding and verify the encoder test passes
- [ ] 5.5 Write a failing test that a cached complete is replayed by `stream` without a new mock call, and verify it fails
- [ ] 5.6 Replay cache hits on stream and verify the replay test passes

## 6. Token accounting

- [ ] 6.1 Write a failing test that complete surfaces the mock’s prompt/completion token counts, and verify it fails
- [ ] 6.2 Thread `TokenUsage` through the response and verify the per-request test passes
- [ ] 6.3 Write a failing test that two successful completes accumulate on `usage(user_id)` and that an exact cache hit still adds the cached usage, and verify it fails
- [ ] 6.4 Implement the per-user ledger and verify the accumulation and cache-hit accounting tests pass

## 7. Providers, secrets, and CI

- [ ] 7.1 Write a failing test that default config prefers `ollama` and constructs dashscope/zhipu/kimi when keys are supplied, and verify it fails
- [ ] 7.2 Implement `GatewayConfig` + OpenAI-compat adapters (no network in tests) and verify the provider-set tests pass
- [ ] 7.3 Write a failing test that Debug of a config holding `sk-secret-test` does not contain that string, and that a missing DashScope key omits that adapter, and verify it fails
- [ ] 7.4 Add `SecretString` redaction and skip adapters with empty keys, and verify the secret tests pass
- [ ] 7.5 Add a crate README (env var names only, no keys), a crate `.gitignore` for `/target`, and `.github/workflows/ai-gateway.yml` path-filtered to `api/crates/ai-gateway/**` running `cargo fmt --check`, `clippy -D warnings`, and `cargo test`, and verify the YAML triggers on pull_request and push to main
- [ ] 7.6 Run `cargo fmt --check`, `cargo test`, and `cargo clippy -- -D warnings` in `api/crates/ai-gateway` and verify all three exit 0

## Workflow follow-up

- Archive the OpenSpec change after implementation and verification.
- Open a PR whose body contains `Refs #3` (not Closes). Do not merge.

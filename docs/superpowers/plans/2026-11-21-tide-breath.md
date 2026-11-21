# 潮汐呼吸 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline; no reviewer fanout). Steps use checkbox (`- [ ]`) syntax for tracking.

I'm using the writing-plans skill to create the implementation plan.

**Goal:** Ship 潮汐呼吸 as a guest-playable Three.js night-ocean game: hold/release waves, guide creatures, collect starlight, unlock real coral gardens, persist locally.

**Architecture:** Follow store/garden: `sim.ts` owns the loop, `persist.ts` owns `qingxin.games.tide-breath`, `TidePlay.svelte` is chrome-glass, `render.ts` is a lazy-loaded Three.js scene with shader water. Catalog flips `tide-breath` to `playable`. Cloud-walk and memory-shelf stay `coming`.

**Tech Stack:** Existing SvelteKit 3, TypeScript, Vitest, Playwright, `three` ^0.187. No new npm. Procedural meshes/shaders/Web Audio.

**Spec:** `docs/superpowers/specs/2026-11-21-tide-breath-design.md`

## Global constraints

- Same PR/branch `cursor/shangban-stage1-4e4e`. No merge/deploy/Mac.
- Theme key `qingxin.theme` never written. Guest playable. No auth/backend.
- `isPlayView` already covers `/play`. Do not mount nebula on the play route.
- No medical claims, no forced breath hold, no session timer, no score pressure.
- Audio only after 海声 gesture. Pause on `document.hidden`. Dispose Three on unmount.
- DPR cap (≤1.5, 1.0 narrow in low-detail). Particle cap 400 / 80. WebGL fail graceful.
- zh-CN. TDD. Genuine Playwright (no seeded complete save / no tick injection as only evidence).

## File map

Create:

- `web/src/lib/games/tide/sim.ts`, `sim.spec.ts`
- `web/src/lib/games/tide/persist.ts`, `persist.spec.ts`
- `web/src/lib/games/tide/render.ts`
- `web/src/lib/games/tide/TidePlay.svelte`
- `web/src/lib/games/tide/audio.ts`
- `web/e2e/tide-breath.e2e.ts`
- screenshots `web/screenshots/tide-breath-*`

Modify:

- `web/src/lib/games/catalog.ts`, `catalog.spec.ts`
- `web/src/routes/modules/games/[id]/play/+page.svelte`
- `web/e2e/games.e2e.ts` (coming-soon target → `cloud-walk`)

---

### Task 1: Field math (TDD)

**Files:** Create `web/src/lib/games/tide/sim.ts`, `sim.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it('raises swell while holding and emits a pulse on release', () => {
  const w = createTide();
  holdTide(w, true);
  stepTide(w, 800);
  expect(w.swell).toBeGreaterThan(0.2);
  const swell = w.swell;
  holdTide(w, false);
  stepTide(w, 50);
  expect(w.pulse).toBeGreaterThan(0.3);
  expect(w.holding).toBe(false);
  stepTide(w, 400);
  expect(w.swell).toBeLessThan(swell);
});

it('does not fail or lock if the optional pace is ignored', () => {
  const w = createTide();
  stepTide(w, 20_000);
  expect(w.over).toBe(false);
  expect(w.collected).toBe(0);
});

it('steers the selected creature and collects nearby starlight', () => {
  const w = createTide();
  const star = w.stars.find((s) => !s.collected)!;
  w.selected = w.creatures[0]!.id;
  steerTide(w, star.x, star.z);
  holdTide(w, true);
  for (let i = 0; i < 80; i++) stepTide(w, 100);
  expect(w.collected).toBeGreaterThanOrEqual(1);
  expect(w.coral.filter((c) => c.unlocked).length).toBeGreaterThanOrEqual(1);
});

it('pauses when asked and does not move swell', () => {
  const w = createTide();
  holdTide(w, true);
  w.paused = true;
  const swell = w.swell;
  stepTide(w, 1000);
  expect(w.swell).toBe(swell);
});
```

- [ ] **Step 2: Run to fail, then implement `createTide` / `stepTide` / `holdTide` / `steerTide`.** Swell rate ~0.35/s up, ~0.22/s down. Pulse decays. First star within ~1.6 of starting jelly. Collect radius 1.15. Coral unlock thresholds 1, 3, 6. Six stars, three coral patches, three creatures. `paceHint` 0..1 cosine is display-only.

- [ ] **Step 3: Persist tests + `qingxin.games.tide-breath` schema 1.** Round-trip collected/coral/lowDetail/audioWanted/dockCollapsed. Garbage JSON recovers.

---

### Task 2: Catalog + play mount

**Files:** `catalog.ts`, `catalog.spec.ts`, `play/+page.svelte`

- [ ] Tide `status: 'playable'`, `playCta: '开始入海'`, `englishTitle: 'Tide Breath'`, about matches the spec. Coming list is `['cloud-walk', 'memory-shelf']`.
- [ ] `play/+page.svelte` mounts `TidePlay` for `tide-breath` (do not fall through to StorePlay).
- [ ] `games.e2e.ts` coming-soon test visits `cloud-walk`.

---

### Task 3: Three.js night ocean + chrome

**Files:** `render.ts`, `TidePlay.svelte`, `audio.ts`

- [ ] `mountTideScene(canvas)` returns null if no WebGL. Else shader water, sky, moon, 3 creature rigs, star orbs, 3 coral groups, plankton points, ACES + fog. `sync(world)`, `render(now)`, `resize`, `dispose`, `hitWater(x,y)`, `project(x,z)`.
- [ ] DPR `min(devicePixelRatio, lowDetail || narrow ? 1 : 1.5)`. Particles 80 vs 400. Shadows off in low-detail/reduced-motion.
- [ ] TidePlay: return link, stats, collapsible dock, pause, 低细腻, 海声, onboarding copy, dataset `ready/swell/pulse/stars/coral/holding/detail/anim`. Hidden tab pauses. Dispose on destroy.
- [ ] Audio: `unlockTideAudio()` only from 海声 click; `setTideMuted`; stop on unmount.

modern-web-guidance retrieve for WebGL canvas pause / reduced-motion **before** writing render.

---

### Task 4: Genuine Playwright

**Files:** `web/e2e/tide-breath.e2e.ts`

- [ ] Guest (privacy consent, **no** completed save). 1280 then 390.
- [ ] Hold Space 800ms → `data-swell` rises; release → `data-pulse` > 0.
- [ ] Arrows + hold until `data-stars` ≥ 1 and `data-coral` ≥ 1 (timeout ~45s). Screenshot before/after collect.
- [ ] Reload: stars/coral persist. Pause. `emulateMedia({reducedMotion:'reduce'})` still paints ocean. Toggle 低细腻. 海声 click then 静音 (no autoplay before click).
- [ ] Store or garden smoke still `data-ready=1`.
- [ ] Screenshots 390/1280 light/dark play; copy to `/opt/cursor/artifacts/`; webm not committed if large.

---

### Task 5: Verify

- [ ] `npx vitest --run src/lib/games/tide src/lib/games/catalog.spec.ts`
- [ ] `npm run check` and `npm run build`
- [ ] Playwright tide + coming-soon + one catalog smoke
- [ ] Report SHA, tests, limits, remaining games

## Self-review

Spec coverage: night ocean, hold/release, guide, collect, coral 3D, no timer, chrome, audio opt-in, persist, a11y modes, WebGL fail, play skip — Tasks 1–4. Cloud/memory not in this plan.

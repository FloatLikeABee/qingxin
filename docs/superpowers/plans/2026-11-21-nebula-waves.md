# Flowing blue-violet nebula waves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline; no reviewer fanout). Steps use checkbox (`- [ ]`) syntax for tracking.

I'm using the writing-plans skill to create the implementation plan.

**Goal:** Replace the current silver-blue outward-dust + circular CSS orbs with calm layered blue-violet nebula waves, drifting particles, star depths, and soft light over near-black, without touching chrome, theme persistence, games, or saves.

**Architecture:** Keep `AppShell` mount rules (`!isPlayView`). Enrich `web/src/lib/shell/dust.ts` (field math) and `SpaceDust.svelte` (paint). Replace `.qx-nebula-a/b/c` circular orbs in `layout.css` with layered wave washes. Hyperframes, once forwarded, maps onto these files — do not add a parallel renderer.

**Tech Stack:** Existing SvelteKit 3, TypeScript, Vitest, Playwright, Canvas 2D + CSS. No new paid installs. No new npm package unless the forwarded Hyperframes source **is** that package and parent includes it.

**Spec:** `docs/superpowers/specs/2026-11-21-nebula-waves-design.md`

---

## HARD GATE — do not implement yet

Parent is still locating the official **Hyperframes** skill/source. This plan is ready for TDD **after** that follow-up.

- [x] **Gate:** Hyperframes official source is in the workspace or pasted in-thread.
- [x] Read it fully. Map wave / particle / star primitives onto `dust.ts` + CSS. If it conflicts with play-view skip, no-paid-install, or theme persistence, **preserve wins**.
- [x] Implementation's first action after the gate: modern-web-guidance **search then retrieve** for canvas 2D nebula/wave (or Hyperframes' stack). Do not skip that retrieve.

Until the gate is checked, stop. Spec/plan/OpenSpec only.

---

## Global constraints

- Same branch/PR: `cursor/shangban-stage1-4e4e`. Do not open a competing PR. Do not merge/deploy/Mac-edit.
- Theme key `qingxin.theme` default `system`. Never overwrite on load.
- Dark `#070b14`; light `#eaf3ff`. Qingxin blue `#3B82F6` / `#60A5FA` plus restrained violet.
- `shouldAnimateDust` stays false when hidden / playView / reduced-motion.
- Unmount field on play views. No shell canvas over Three.js.
- Contrast on `.qx-glass` ≥ 4.5:1. `pointer-events: none`.
- DPR cap ≤ 1.5, ≤36 motes (24 narrow), ~24 fps skip-frames, dispose on destroy.
- zh-CN. Guest + existing e2e fixtures. No auth/backend.

## File map

Create:

- `docs/superpowers/specs/2026-11-21-nebula-waves-design.md` (this pair)
- `docs/superpowers/plans/2026-11-21-nebula-waves.md`
- `openspec/changes/nebula-waves-shell/**`
- `web/e2e/nebula-waves.e2e.ts`

Modify (after gate):

- `web/src/lib/shell/dust.ts`, `dust.spec.ts`
- `web/src/lib/shell/SpaceDust.svelte`
- `web/src/routes/layout.css` (`.qx-nebula*`, keyframes)
- `web/e2e/space-glass.e2e.ts` only if selectors/cadence assertions must follow new `data-*`
- screenshots: `web/screenshots/nebula-waves-*`

Do **not** modify: `nav.ts` destinations, AppShell top bar structure, `theme/resolve.ts` tokens (bg stays), persist/save keys, game renderers, auth.

---

### Task 0: Ingest Hyperframes + modern-web-guidance (after gate)

**Files:** forwarded skill/source; do not invent APIs

- [x] **Step 1:** Copy/install the official Hyperframes skill into the workspace if parent provided a file; otherwise follow the pasted source.
- [x] **Step 2:** modern-web-guidance search/retrieve for the actual paint path (canvas 2D waves vs Hyperframes' documented API).
- [x] **Step 3:** Write a 10-line mapping in the PR notes: Hyperframes primitive → `dust.ts` function / CSS class. No extra agents.

---

### Task 1: Field math (TDD)

**Files:** `web/src/lib/shell/dust.ts`, `dust.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
describe('nebula wave field', () => {
  it('starts with layered waves, two star depths, and a bounded mote count', () => {
    const wide = createDustField(1, 1280, 800);
    expect(wide.waves.length).toBeGreaterThanOrEqual(2);
    expect(wide.starsFar.length).toBeGreaterThan(0);
    expect(wide.starsNear.length).toBeGreaterThan(0);
    expect(wide.motes).toHaveLength(DUST_MOTES);
    const narrow = createDustField(1, 390, 844);
    expect(narrow.motes).toHaveLength(DUST_MOTES_NARROW);
  });

  it('drifts waves and particles slowly and never teleports a wave across the board in one 16ms step', () => {
    const field = createDustField(7, 800, 600);
    const next = stepDust(field, 16, { reducedMotion: false });
    for (let i = 0; i < next.waves.length; i++) {
      expect(Math.abs(next.waves[i]!.phase - field.waves[i]!.phase)).toBeLessThan(0.05);
    }
  });

  it('does not animate when hidden, playing, or reduced-motion', () => {
    expect(shouldAnimateDust({ hidden: true, playView: false, reducedMotion: false })).toBe(false);
    expect(shouldAnimateDust({ hidden: false, playView: true, reducedMotion: false })).toBe(false);
    expect(shouldAnimateDust({ hidden: false, playView: false, reducedMotion: true })).toBe(false);
    expect(shouldAnimateDust({ hidden: false, playView: false, reducedMotion: false })).toBe(true);
  });

  it('keeps the field identical under reduced motion', () => {
    const field = createDustField(3, 640, 480);
    const copy = structuredClone(field);
    expect(stepDust(field, 1000, { reducedMotion: true })).toEqual(copy);
  });
});
```

Adjust exact property names to Hyperframes mapping, but keep these behaviors.

- [ ] **Step 2:** Run `npx vitest --run src/lib/shell/dust.spec.ts` — RED
- [ ] **Step 3:** Implement waves, star depths, drift; keep `shouldAnimateDust`; keep spawn bounds
- [ ] **Step 4:** GREEN. Existing outward-only assertions may be replaced; pause/reduced-motion tests must remain.

---

### Task 2: Paint + CSS waves

**Files:** `SpaceDust.svelte`, `layout.css`

- [ ] Dark paint: blue/violet wave fills, particles, two star depths, soft accents. Light paint: quieter blue, almost no violet.
- [ ] Replace `.qx-nebula-a/b/c` circles with layered wave shapes (pseudo-elements or extra spans). Keep `.qx-nebula` behind chrome, `pointer-events: none`.
- [ ] `@keyframes` period ≥ 20s; `prefers-reduced-motion: reduce` → `animation: none` and a still composition that is still nebula-like (not a blank `#070b14`).
- [ ] Keep `data-qx-dust`, `data-anim`, `data-cadence`. Dispose rAF, resize, visibility, matchMedia on destroy.
- [ ] Hidden tab: `data-anim=0` and no catch-up burst on return.

---

### Task 3: Preserve shell / theme / play skip (regressions)

**Files:** existing `dust.spec.ts` pause cases, `theme/resolve.spec.ts`, `space-glass.e2e.ts`, `nav.spec.ts` (read-only)

- [x] Guest load still does not write `qingxin.theme`.
- [x] `palette.dark.background` remains `#070B14`.
- [x] `/modules/shangban`, `/modules/jimutai`, `*/play` → `[data-qx-dust]` count 0, no `.qx-nebula` node.
- [x] `/` and `/modules` still have top bar, no `aside`, dust behind glass.

---

### Task 4: E2E evidence over time (not class-only)

**Files:** `web/e2e/nebula-waves.e2e.ts`

- [x] Dark 1280 and 390: body bg near `rgb(7,11,20)`; glass contrast ≥ 4.5:1; `data-anim=1`.
- [x] **Animation evidence:** sample canvas pixels or `data-cadence` **and** two screenshots 1.2s apart whose pixel buffers differ, but per-channel max delta stays below a flash threshold (no full-frame blink).
- [x] Reduced-motion: `data-anim=0` after 400ms; still screenshot is not a flat fill (nebula/stars visible).
- [x] Visibility: hide → `data-anim=0`; show → animates again without a burst.
- [x] Light 1280: dawn bg, glass readable, field present but quieter.
- [x] Theme fixture `light` stays `light` after visiting hub (no overwrite).
- [x] Record a short webm; do not commit multi-MB video.

---

### Task 5: Verify

- [x] `npx vitest --run src/lib/shell/dust.spec.ts src/lib/theme/resolve.spec.ts`
- [x] `npm run check` and `npm run build` in `web/`
- [x] Playwright: `nebula-waves.e2e.ts` + space-glass reduced-motion/play-unmount tests
- [x] Screenshots: `nebula-waves-hub-1280-dark.png`, `nebula-waves-hub-390-dark.png`, `nebula-waves-hub-1280-light.png`, `nebula-waves-reduced-1280.png`, plus t+1.2s pair
- [x] Honest cadence from `data-cadence` (rAF dt, not GPU FPS)

---

## Self-review

- Spec coverage: waves, particles, stars, soft light, near-black, calm, glass, light theme, reduced-motion, hidden, play skip, DPR, cleanup, Hyperframes gate — all have a task.
- Type names in Task 1 tests (`waves`, `starsFar`) may rename to Hyperframes terms; behaviors must not.
- No auth, no save migration, no game-world lighting.
- Plan is executable only after Task 0 gate.

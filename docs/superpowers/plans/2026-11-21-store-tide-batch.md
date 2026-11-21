# Store longer shift + Tide marine sky Implementation Plan

> **For agentic workers:** Use executing-plans inline this run. First batch only (store then tide). Stop at checkpoint.

**Goal:** Ship approved 1800-tick store shift, then tide marine collectibles + constellation night sky.

**Architecture:** Store: default `dayTicks` only. Tide: sim copy + kinds; render camera/sky/rigs/seabed.

**Tech Stack:** SvelteKit, Vitest, Playwright, Three.js already in repo.

## Global Constraints

- Descendant of `bef399c`. No force-push. No merge/main. No paid npm. CE/ECC unused.
- Preserve 上班 move + unstick. Other five approved games not this run.
- TDD. Fresh guest e2e. No seeded complete tide save as only proof.

### Task 1: Store 1800-tick shift

**Files:** `web/src/lib/games/store/sim.ts`, `sim.spec.ts`, `StorePlay.svelte`, `web/e2e/store-shift.e2e.ts`

- [ ] Failing tests: default 1800, action timings unchanged, pause/restart, several sells in 500 ticks, clock `3:00`
- [ ] Implement `STORE_SHIFT_TICKS`, `formatShiftClock`, canvas `data-tick` / `data-day-ticks` / `data-paused`
- [ ] Commit store only

### Task 2: Tide marine + sky

**Files:** `tide/sim.ts`, `sim.spec.ts`, `TidePlay.svelte`, `render.ts`, `catalog.ts` copy only, `tide-breath.e2e.ts`

- [ ] Failing tests: 海光 notices, six kinds, coral thresholds, constellation export length 4
- [ ] Render: camera, sky, stars always, 4 lines, 6 rigs, seabed, datasets
- [ ] Commit tide only

### Task 3: Verify checkpoint

check, full unit, build, store/tide/上班 catalog+legacy e2e, screenshots, PR, stop.

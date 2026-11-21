# 手术 Operation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the t275u-approved 手术 game (visual lane R only) as a four-region fictional surgical toy behind a blocking graphic-content gate.

**Architecture:** Headless `sim.ts` owns warning/hub/field, phases, tools, bleed, and seeds. `persist.ts` writes only `qingxin.games.operation`. `render.ts` mounts one Three.js scene at a time (hub figure or close-up field). `OpPlay.svelte` never mounts graphic WebGL until acknowledgement. Catalog cover is an OR lamp, not a wound.

**Tech Stack:** SvelteKit, TypeScript, Three.js, Vitest, Playwright.

---

### Task 1: Phase FSM, tools, blood, four seeds

**Files:**
- Create: `web/src/lib/games/op/sim.ts`
- Create: `web/src/lib/games/op/sim.spec.ts`

- [ ] RED: phases, illegal tool notice, bleed up on open/slip and down on suction/pressure, close stops flow, reduced-motion does not zero bleed, four regions complete, replay new seed, recover mistakes without stuck phase.
- [ ] GREEN: implement `createOp` / `ackGraphic` / `pickRegion` / pointer gestures / `stepOp`.
- [ ] Commit.

### Task 2: Scoped persist

**Files:**
- Create: `web/src/lib/games/op/persist.ts`
- Create: `web/src/lib/games/op/persist.spec.ts`

- [ ] Save `graphicAck`, stars, lastSeed, audio/spray/detail/dock only. Missing ack reloads to warning. Sibling keys and `qingxin.theme` untouched. Corrupt → recovered hub if ack else warning.
- [ ] Commit.

### Task 3: Warning, hub, graphic field

**Files:**
- Create: `web/src/lib/games/op/render.ts`
- Create: `web/src/lib/games/op/audio.ts`
- Create: `web/src/lib/games/op/OpPlay.svelte`
- Modify: catalog, GameCover, play switch, catalog/filter specs, games.e2e

- [ ] Blocking acknowledgement before any graphic scene or audio.
- [ ] Hub 前臂/膝/口腔/腹 playable; extras 未开放.
- [ ] Close-up tissue, wound lips, blood film/pool/capped spray, tools that follow the pointer.
- [ ] Sound off until 器械声; reduced motion drops camera lunge/spray not blood materials.
- [ ] Commit.

### Task 4: E2E + screenshots + STOP

**Files:**
- Create: `web/e2e/operation.e2e.ts`

- [ ] Warning gate on direct play and reload; all four regions by natural gestures; bleed rises/falls; wrong tool; mobile pause; sibling smoke; no seeded complete.
- [ ] Screenshot warning/hub (nongraphic) and field tool/blood/closed at 1280, 390, reduced-motion. Inspect PNGs.
- [ ] `npm run check`, full vitest, `CI=1` Playwright. Push stacked PR. STOP.

# 手术 cut then sew Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline (user delegated existing cloud workflow; no subagent fanout). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the five-phase chore list with exactly two actions — **切开** then **缝合** — using only **刀** and **缝针**, while keeping the warning gate, four distinct body regions, and connected hub.

**Architecture:** Delete prepare/expose/operate/hemostasis/close and extra tools from `sim.ts` (not a HUD hide). Cut and sew are both path gestures on the marked line. Slip nicks blood only. Schema 2 reads schema 1 ack/stars/settings and always restarts the field at cut.

**Tech Stack:** SvelteKit 3, TypeScript, three ^0.187, Vitest, Playwright.

## Global Constraints

- Ancestor `d0db96c` (PR #49 cloud). Branch `cursor/operation-cut-sew-4e4e`, stack on PR #49. No main/merge/Mac/force-push.
- Preserve truck + cloud. Do not edit cargo/cloud except sibling boot list in operation e2e.
- Four regions (forearm, knee, tooth, belly) + locked 胸/脊/眼 + warning before any WebGL.
- Mute default. 少喷溅 / 低细腻 / reduced-motion stay. Stars 1–3 from path accuracy after sew.
- Slip must **not** reset phase or progress. Easy for the user.
- Catalog `about` drops 准备/显露/止血/冲洗/器械清单; says 切开、缝合.
- 刀 / 缝针 ≥44 px on coarse/390 (`pointer: coarse`). Safe-area already on HUD.
- No paid assets. Procedural graphics, not photoreal claims.
- 货架 / Cooking / Hospital out of this batch.

## File map

- Modify: `web/src/lib/games/op/sim.ts` + `sim.spec.ts` — PHASES, tools, slip, blood
- Modify: `web/src/lib/games/op/persist.ts` + `persist.spec.ts` — schema 2
- Modify: `web/src/lib/games/op/OpPlay.svelte` — two-phase HUD, two tools, 2D path overlay if WebGL fails
- Modify: `web/src/lib/games/op/render.ts` — only scalpel+needle meshes; wound guideline on all four regions; tools unoccluded
- Modify: `web/src/lib/games/catalog.ts` + `catalog.spec.ts` — about/summary
- Modify: `web/e2e/operation.e2e.ts` — natural pointer cut+sew all four; 390; siblings

---

### Task 1: Two phases, two tools, slip keeps progress (RED then GREEN)

**Files:**
- Modify: `web/src/lib/games/op/sim.ts`
- Test: `web/src/lib/games/op/sim.spec.ts`

**Interfaces:**
- `PHASES = ['cut', 'sew'] as const`
- `PHASE_LABEL`: cut `切开`, sew `缝合`, done `完成`
- `ToolId = 'scalpel' | 'needle'`
- `TOOL_LABEL`: scalpel `刀`, needle `缝针`
- `legalTools(world)` ⊆ `{scalpel, needle}`
- `REGIONS[id].tools = ['scalpel', 'needle']`
- `steps.cut = { tool: 'scalpel', gesture: 'path' }`; `steps.sew = { tool: 'needle', gesture: 'path' }`
- `resetProcedure` starts `phase: 'cut'`, `tool: 'scalpel'`
- `setOpTool` ignores any id other than scalpel/needle; does **not** wipe `progress` / `pathBins`
- `maybeSlip`: increment `slips`, bump bleed, notice; **do not** zero `progress` or `pathBins` or change `phase`

- [ ] **Step 1: Failing tests** (rewrite `sim.spec.ts` expectations)

```ts
it('PHASES is exactly cut then sew', () => {
  expect(PHASES).toEqual(['cut', 'sew']);
  expect(PHASE_LABEL.cut).toBe('切开');
  expect(PHASE_LABEL.sew).toBe('缝合');
  for (const id of Object.keys(REGIONS) as Array<keyof typeof REGIONS>) {
    expect(REGIONS[id].tools).toEqual(['scalpel', 'needle']);
    expect(Object.keys(REGIONS[id].steps).sort()).toEqual(['cut', 'sew']);
  }
});

it('wrong tool is a non-blocking hint and does not advance', () => {
  const world = createOp(11);
  ackGraphic(world);
  pickRegion(world, 'forearm');
  expect(world.phase).toBe('cut');
  setOpTool(world, 'needle');
  completePath(world);
  expect(world.phase).toBe('cut');
  expect(world.progress).toBe(0);
  expect(world.notice).toMatch(/现在不能用|请用刀/);
});

it('forearm cut raises bleed, sew lowers it, complete awards stars', () => {
  const world = createOp(21);
  ackGraphic(world);
  pickRegion(world, 'forearm');
  setOpTool(world, 'scalpel');
  completePath(world);
  expect(world.phase).toBe('sew');
  expect(world.bleed).toBeGreaterThan(8);
  const peaked = world.bleed;
  setOpTool(world, 'needle');
  completePath(world);
  expect(world.phase).toBe('done');
  expect(world.complete).toBe(true);
  expect(world.bleed).toBeLessThan(peaked);
  expect(world.stars.forearm).toBeGreaterThan(0);
});

it('a slip does not reset phase or progress', () => {
  const world = createOp(9);
  ackGraphic(world);
  pickRegion(world, 'forearm');
  setOpTool(world, 'scalpel');
  const lay = fieldLayout('forearm', world.seed);
  pointerDown(world, lay.path.x0, lay.path.y0);
  pointerMove(world, lay.path.x0 + (lay.path.x1 - lay.path.x0) * 0.4, lay.path.y0);
  stepOp(world, 0.05);
  pointerUp(world);
  const kept = world.progress;
  expect(kept).toBeGreaterThan(0.15);
  pointerDown(world, 0.08, 0.12);
  stepOp(world, 0.2);
  pointerUp(world);
  expect(world.phase).toBe('cut');
  expect(world.progress).toBe(kept);
  expect(world.slips).toBeGreaterThan(0);
});
```

Keep: warning-before-field, four region names, reduced-motion bleed, all-four complete via `runRegion` using only scalpel path then needle path. Drop gauze/suction/forceps/elevator/bag tests.

- [ ] **Step 2: Run RED** `cd web && npx vitest --run src/lib/games/op/sim.spec.ts`

- [ ] **Step 3: Implement** in `sim.ts`:

```ts
export const PHASES = ['cut', 'sew'] as const;
export type ToolId = 'scalpel' | 'needle';
export const TOOL_LABEL: Record<ToolId, string> = { scalpel: '刀', needle: '缝针' };
export const PHASE_LABEL: Record<Phase, string> = { cut: '切开', sew: '缝合', done: '完成' };
```

Every region: same two steps, blurbs say cut then sew (tooth = marked gum line, belly = small line). `maybeSlip` only when `phase === 'cut' && tool === 'scalpel'` and far from path — bump bleed, `slips++`, notice `刀滑了一下。伤口还在。` — leave `progress`/`pathBins`/`phase`. Cut path raises `flow`/`bleed`/`spray`; sew path lowers `flow`/`bleed`. `applyBlood` no suction/gauze. `setOpTool` returns if tool not in `{scalpel, needle}`. Stale `world.tool` coerced to scalpel in `resetProcedure`.

- [ ] **Step 4: GREEN** existing warning/hub/region-name tests still pass.

- [ ] **Step 5: Commit** `fix(op): cut then sew with scalpel and needle only`

---

### Task 2: Persist schema 2

**Files:** `persist.ts`, `persist.spec.ts`

- `OP_SCHEMA = 2`
- `parseOpSave` accepts schema **1 or 2**. Keep `graphicAck`, `stars` (four ids), `lastSeed`, `lessSpray`, `lowDetail`, `audioWanted`, `dockCollapsed`. Ignore `phase`/`tool`/`complete`.
- Write schema 2. Field entry via `hydrateOp` / `pickRegion` starts at **cut**.
- Foreign schema recovers. Sibling `qingxin.*` keys untouched.

```ts
it('schema 1 stars and ack survive and field restarts at cut', () => {
  const s = mem({
    'qingxin.games.cargo-haul': '{"schema":2}',
    [OP_KEY]: JSON.stringify({
      schema: 1,
      graphicAck: true,
      stars: { forearm: 2, knee: 1, tooth: 0, belly: 0 },
      lastSeed: 9,
      audioWanted: true,
      lessSpray: true,
      lowDetail: false,
      dockCollapsed: false,
      phase: 'hemostasis',
      tool: 'suction'
    })
  });
  const { world } = loadOpSave(s);
  expect(world.graphicAck).toBe(true);
  expect(world.stars.forearm).toBe(2);
  expect(world.audioWanted).toBe(true);
  expect(world.lessSpray).toBe(true);
  pickRegion(world, 'forearm');
  expect(world.phase).toBe('cut');
  expect(world.tool).toBe('scalpel');
  expect(s.raw['qingxin.games.cargo-haul']).toBe('{"schema":2}');
  writeOpSave(s, world);
  expect(JSON.parse(s.raw[OP_KEY]).schema).toBe(2);
  expect(JSON.parse(s.raw[OP_KEY]).phase).toBeUndefined();
});
```

---

### Task 3: HUD + render + catalog

**Files:** `OpPlay.svelte`, `render.ts`, `catalog.ts`, `catalog.spec.ts`, `audio.ts` (scalpel/needle sounds only)

HUD:
- Phase list is 切开 / 缝合 only.
- Tray: 刀 + 缝针 only. `min-height/min-width: 44px`; `@media (pointer: coarse)` keep 44px.
- Copy: 沿标记线切开，再沿同一条线缝合。
- Warning copy + 我已知晓，进入手术 unchanged. Mark 含血腥 · 虚构娱乐，不是医疗训练.
- WebGL fail: keep pointer UV; show a 2D overlay of the marked line (cut progress / sew stitches) so the field is still playable.

Render:
- `toolMap` only `scalpel` and `needle`. Delete gauze/forceps/suction/irrigator/bandage/elevator/grasper/bag from the field kit (do not leave them selectable).
- All four regions: emissive **guideline** along `fieldLayout.path` so the wound target is visible (not warning-only).
- Tools sit slightly toward the camera (`uvWorld` y + 0.12) so they are not buried in tissue.
- Open amount: `cut` uses progress; `sew` closes; `done` almost closed with sutures (not tooth extraction / stone bag).
- Tooth: gum cut + sew, marked tooth stays; no elevator extract.
- Belly: small line, no stone pick.
- Blood film/pool remain; reduced-motion spray cap 0.

Catalog:
- `summary`: 在四个虚构解剖区域里切开、缝合。…
- `about`: drop 准备/显露/止血/冲洗/器械清单 / 镊、吸引、纱布. Include 切开、缝合 and 刀、缝针.

---

### Task 4: Playwright — natural pointer, all four regions

**Files:** `web/e2e/operation.e2e.ts`

No `page.evaluate` that writes `phase`/`tool`/`progress`. Helpers only click 刀/缝针 and drag along `data-target-y`.

- Warning still blocks hub; canvas count 0 until ack; reload without ack stays warning.
- Kit: `getByRole('button', { name: '吸引'|'冲洗'|'纱布'|'挺子'|'镊'|'抓钳'|'取袋'|'绷带' })` count 0.
- Forearm: wrong tool 缝针 on cut → notice, `data-phase=cut`; then 刀 path → `sew` + bleed up; 缝针 path → `data-complete=1`. Shots: cut 1280, sew 1280, complete 1280.
- Knee, tooth, belly: same two-path complete. Shots field + complete 1280.
- Pause/resume on field.
- 390: warning, hub, forearm cut+sew; both 刀 and 缝针 boundingBox ≥ 44; shot **active field** (not warning-only).
- Schema 1 init keeps ack/stars; next field `data-phase=cut`.
- Reduced motion: bleed > 8, spray 0.
- Sibling boots: `/modules/games/cargo-haul/play` canvas 重卡公路; `/modules/games/cloud-walk/play` canvas 云上散步天空.

Read PNGs of 1280 cut/sew/complete and 390 active field. If tools or wound line are missing/occluded, fix render then recapture.

---

### Task 5: Verify

`cd web && npx svelte-check --tsconfig ./tsconfig.json`  
`npx vitest --run`  
`CI=1 npx playwright test e2e/operation.e2e.ts`

Commit, push `cursor/operation-cut-sew-4e4e`, stacked PR on #49. STOP. No shelf/cooking/hospital.

## Self-review vs spec

| Spec | Task |
|---|---|
| Only 切开 then 缝合; only 刀 + 缝针; delete 5-phase/tools not hide | 1, 3 |
| Slip does not reset phase/progress | 1 |
| Four regions + hub + warning + mute default + reduced-motion | 1, 3, 4 |
| Schema 2 reads 1; keep ack/stars/settings; field restarts cut | 2 |
| Catalog about 切开、缝合 | 3 |
| Natural pointer all 4; no DOM phase force | 4 |
| Wrong tool hint; pause; guest gate; 390 44px; 2D fallback | 1, 3, 4 |
| Sibling truck + cloud | 4 |
| Procedural not photoreal | 3 |

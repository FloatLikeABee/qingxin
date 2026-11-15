# 便利店经理 Three.js Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. User forbade spawned reviewer agents — execute inline.

**Goal:** Make the existing Three.js convenience store readable and more realistic (packaging, fridge, checkout, shopper actions, lighting) without changing the simulation/scoring loop.

**Architecture:** `sim.ts`, `goods.ts`, `layout.ts`, `persist.ts` stay the gameplay contract. All visual work lives in `render.ts`. HUD/camera/keyboard/hidden-tab live in `StorePlay.svelte`.

**Tech Stack:** Existing Three.js + SvelteKit. No new dependencies.

## Global Constraints

- Do not change restock/order/pay math or shopper phases.
- Do not edit shooter files.
- Same PR 36. Qingxin palette. 390 and 1280. Pause on hidden tab.
- WebGL fail: explanation + shelf buttons still operate.
- Camera must not hide shelves under the HUD.

---

### Task 1: Guard the sim (regression tests already exist)

**Files:**
- Test: `web/src/lib/games/store/sim.spec.ts` (do not weaken)
- Optional: add `it('shopper pick then pay still scores water at catalog price')` only if a gap exists — current file already covers restock, pay, sold-out, queue patience.

- [ ] **Step 1: Run** `npx vitest --run src/lib/games/store`
- [ ] **Step 2: Confirm green before visual edits**

---

### Task 2: Packaging, fridge, checkout, shopper actions

**Files:**
- Modify: `web/src/lib/games/store/render.ts`

**Produces:** labeled canvas textures per SKU; milk fridge with glass door; checkout register + bag drop; shopper walk bob / pick reach / pay lean; stronger empty-shelf coral; slightly higher camera so the bottom HUD does not cover pick targets; `pixelRatio` min(dpr, 1.5) when canvas height < 700.

- [ ] **Step 1: No unit test for meshes.** Keep `layout.spec.ts` as the spatial contract.
- [ ] **Step 2: Implement visual upgrade; reuse unit geometries; dispose textures on `dispose()`.**
- [ ] **Step 3: Run store unit tests — still pass**
- [ ] **Step 4: Commit** `feat(store): labeled stock, fridge, animated shoppers`

---

### Task 3: HUD, keyboard, hidden-tab pause

**Files:**
- Modify: `web/src/lib/games/store/StorePlay.svelte`

- [ ] Large 从库房补货; low-stock badge on the selected/empty shelf card; shorter guidance.
- [ ] Keys 1–5 select shelf, `r` restock (ignore when typing in an input — there is none).
- [ ] `document.hidden` pauses ticking (same as garden).
- [ ] WebGL fail copy stays, shelf buttons remain.

- [ ] **Commit** `feat(store): restock HUD and hidden-tab pause`

---

### Task 4: Playwright

**Files:**
- Modify: `web/e2e/games.e2e.ts` — select a shelf, restock, assert shoppers (`data-shoppers` on canvas after wait).
- Screenshots 390/1280 light/dark including before/after copies already saved as `before-store-play-*.png`.
- Recording of restock + a shopper at checkout.

---

### Spec coverage

Packaging, fridge, checkout, shopper actions, lighting, low-stock, large restock, camera vs HUD, keyboard, hidden pause, WebGL fail, sim intact — all tasked.

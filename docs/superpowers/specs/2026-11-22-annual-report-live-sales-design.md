# 年报 — 五秒示意销售脉搏（t282u follow-up）

Independent **follow-up** to the shipped 年报 workbook (`annual-report`). Not Excel, not a live market feed, not a stock-trading game.

**Status:** written spec for parent review. **Approved in principle** by user widget 2026-11-22 16:30: *Approved. Add five-second simulated sales with linked recalculation, highlights, and pause controls.* Do **not** implement until this document is reviewed. No production-code changes in this commit.

**Catalog / routes / save key stay:** id `annual-report`, play `/modules/games/annual-report/play`, key `qingxin.games.annual-report`. Company remains **青柠示意有限公司**. Disclaimer remains **本表是游戏里的虚构公司数据，不是真实财报，也不连接 Excel。**

## Player fantasy

The ledger is alive the way a shop floor is alive: every few seconds a **fictional day’s sales** move, and **revenue, profit, assets, and cash update together** because they are the same company, not four random cells. You can pause the pulse, edit, undo, and keep your formulas. You are still making a toy annual report — not watching a Bloomberg terminal.

If numbers on the three statements jitter independently, it failed. If a tick overwrites a formula the guest typed, it failed. If hiding the tab dumps a burst of missed ticks, it failed.

## What exists (HEAD of this workstream)

Shipped 年报 (schema **1**): four sheets 假设 / 利润表 / 资产负债表 / 现金流量表; custom DAG (`engine.ts`); guest `applyEdit` + in-memory undo/redo (cap 50, **not** persisted); seed formulas already **link** 假设 drivers → 利润表 → 资产负债表 / 现金流量表 (see `seed.spec.ts` growth change moves NI, assets, cash together and the BS still ties). Ledger ink is isolated from glass theme. There is **no** timer and **no** live sales pulse.

t283u **股市模拟** is a **different** game, awaiting its own initial design approval. It is **out of scope** here and must not be designed or coded in this follow-up.

## Approaches

### A. Independently jitter formula cells every 5s (reject)

Parent already rejected this. Breaks accounting identity, fights undo, looks like a broken spreadsheet.

### B. Recommend: pulse **value inputs** on 假设, existing DAG recalc, one 5s timer

Write only a small, labeled block of **numeric value cells** on 假设. Seed (and only seed) 利润表 revenue formulas so they **read** those cells. Tick never writes `=` strings. Pause / hide / unmount skip the clock with **no catch-up**.

### C. Rewrite three statements from a hidden JS ledger (reject)

Bypasses the grid the guest is playing. Guest edits and formulas would desync from “real” numbers.

## Pulse inputs (the only cells the timer may write)

Add a clearly labeled 假设 block **「示意销售脉搏」**, default rows **50–54** (implementation may shift one row if 假设 already grew; ids below are the contract):

| Addr | Role | Kind | Seed | Clamp each tick |
| --- | --- | --- | --- | --- |
| A50 | Title | text | `示意销售脉搏（游戏，非行情）` | never written after seed |
| B50 | 当日销量指数 | **value** | `1` | 0.85–1.18 |
| C50 | 当日单价指数 | **value** | `1` | 0.94–1.08 |
| B51 | 说明 | text | `每 5 秒按种子走动。暂停后可改。不是真销售。` | never written |
| B52 | optional mirror of `liveTick` | value | `0` | integer, +1 per applied tick |

**Workbook field `liveTick` (integer) is the source of truth.** Persist it on the save, not as a formula. Optional cell B52 may display it; if the sheet is too noisy, omit B52 and do not invent another pulse cell. **Timer writes B50, C50, and `liveTick` only** (plus B52 only when that cell exists and is not a formula). Never A-column labels, never 利润表 / 资产负债表 / 现金流量表, never any cell whose `raw` starts with `=`.

**Seed formula change (implementation, after approval):** 利润表 营业收入 for 2026 (and/or the 12 monthly columns that already split 2025) multiply the existing driver chain by `假设!B50*假设!C50`. Example shape, not a lock on exact A1:

`=C5*(1+假设!D6)*假设!B50*假设!C50` **or** monthly `=$C5*假设!B{35+m}/SUM(...) * 假设!$B$50*假设!$C$50`

Downstream NI, BS assets/cash, CF ending cash **must not** gain their own random terms. They move because they already reference 利润表 / 假设.

If a guest has **replaced** a revenue formula so it no longer references B50/C50, the pulse still writes the index cells; the three statements follow only if the guest’s formulas still read them. **恢复示例表** restores seed formulas + pulse block. Tick must **not** “heal” a custom formula.

## One timer

- Interval **5000 ms**, **one** `setInterval` (or equivalent) owned by `ReportPlay` onMount.
- Fire only when **all** are true: document `visibilityState === 'visible'`; play view mounted; `livePaused === false`; formula bar / cell editor **not** focused (focus or pointer-down on B50/C50 counts as editing for that beat); no in-flight `applyEdit` of the same addresses.
- On `visibilitychange` hidden, `pagehide`, or unmount: **clear** the interval (or skip callbacks). Do **not** store missed ticks. Resume starts a **fresh** 5s from now — **no catch-up burst**. Hidden time must not be added to the interval.
- `livePaused` is a guest control 「暂停脉搏」 / 「继续脉搏」 (44×44 on coarse). Separate from sheet selection. Default **running** when play opens, unless the save says paused.
- While paused, guest may edit pulse cells and any other cells; the next tick after 继续 waits a full 5s.

## Linked recalc

Each applied tick:

1. Draw two uniforms from the **persisted** mulberry32 `liveSeed` (create seed on first pulse-capable save; never from wall clock alone).
2. Set B50/C50 inside clamps (smooth-ish: lerp toward a target, or small bounded step — not a coin-flip 0↔max). Increment workbook `liveTick`. If B52 exists and is not a formula, set it to `liveTick`.
3. Call existing `evaluateBook`. 利润表 营业收入 / 净利润, 资产负债表 资产总计, 现金流量表 期末现金 **all change together** when seed formulas are intact. Tie identity on 资产负债表 must still hold within the same tolerance as `seed.spec.ts` (~0.5).
4. Do **not** write NI, assets, or cash cells directly.

## Highlights

- After a tick, mark cells whose **displayed value** changed this pulse (pulse inputs + dependent computed cells currently in view, and at least 利润表 营业收入, 净利润, 资产负债表 资产总计, 现金流量表 期末现金 even if off-screen via a short notice).
- Highlight lasts **~1.2s**, then clears. No animation that hides digits. Use a fill that **preserves ledger light/dark contrast** (warm paper / dark ink already isolated in `sheetTheme.ts`). Do **not** flash the whole grid. Do **not** persist highlight fill into `cell.fill` the guest set (use a separate `pulseFlash: addr[]` on the workbook, not the cell format).
- Pause: no new flashes.

## Edit collision, formulas, undo, save

| Event | Rule |
| --- | --- |
| Guest editing (formula bar focused, IME, pointer-down on editor) | Skip this due tick. Do not queue it. |
| Guest `applyEdit` on B50/C50 while live | **Skip the due tick** if the formula bar, in-cell editor, or B50/C50 itself is focused. If none of those are focused, the live feed may overwrite B50/C50 (those two cells are the pulse). Guest can always pause and then edit them. Other cells are never overwritten by the timer. |
| Formula cells | Tick never `setRaw` on `raw.startsWith('=')`. |
| Undo / redo | Tick writes **do not** push onto `book.undo`. Guest undo still reverts the last **guest** patch only. After undo of a guest edit on a non-pulse cell, the next tick does not re-apply that guest edit. After undo of a guest edit **on B50**, the next live tick may write B50 again unless paused. Redo unchanged. Undo stack still **not** persisted. |
| 恢复示例表 | Resets seed workbook **including** pulse block and `liveSeed` (new seed). Other `qingxin.*` keys untouched. |
| Save | Key stays `qingxin.games.annual-report`. **Schema 2.** Persist sheets (pulse values live in cells), `livePaused`, `liveSeed`, `liveTick`, existing title/company/active/dockCollapsed. Schema 1: keep all saved cells; **insert the pulse block only where those addrs are empty**; **do not rewrite** an existing 利润表 revenue formula (even if it does not yet read B50/C50). Notice 「年报接上了示意销售脉搏。」 Do not wipe custom C6. Linked three-statement follow-through on a migrated custom book starts after the guest adds the index product **or** uses 恢复示例表. Foreign/corrupt: existing recover. Size cap still ~400KB. Sibling keys untouched. |

## HUD / 390

- Disclaimer stays visible. Pulse state in the operate HUD: 「脉搏开」/「已暂停」 + last tick age is optional; required is the pause control.
- 390: pause control min 44×44; do not cover the formula dock. Safe-area already on play chrome.
- Audio: none required. No market-stinger SFX.

## Test acceptance (when implemented — not this run)

- Unit: one tick changes B50 and/or C50 inside clamps; NI, assets, cash **all** move vs pre-tick; BS still ties; a cell with `=SUM(A1:A2)` is unchanged raw; skipped ticks while `livePaused` or hidden do not change `liveTick`; 3 skipped beats then resume apply **one** tick after 5s, not three.
- Unit: schema 1 workbook without pulse cells loads, gains B50/C50, keeps a custom 假设!C6.
- Unit: `applyEdit` then undo still restores the guest value after an intervening tick on B50 (undo stack ignores ticks).
- Playwright: pause, edit C6, dependents move; pulse highlight appears then clears; hide tab 15s, show, **no** burst; 390 pause target ≥44px; disclaimer still there; sibling games boot. No network to market-data hosts.

## Visual

Operate-mode ledger, not a trading heatmap. Pulse highlight is a brief warm/cool cell veil on top of existing ink, readable in light and dark.

## Out of scope

- Implementing this pulse before spec review.
- t283u 股市模拟 (separate approval).
- Real sales, tickers, ISIN, paid data, Excel, `.xlsx`.
- Catch-up / background tab accounting.
- Overwriting guest formulas, merging undo with ticks.
- Cooking, Hospital, Mac, main, merge.

## Self-review

| Risk | Resolution |
| --- | --- |
| Placeholder addrs 50–54 | Contract is the pulse **block**; row may shift if 假设 length changes, but B50/C50 in this spec are the default. Implementation plan must name final addrs. |
| Contradiction vs “guest may overwrite any value” (v1 spec) | Pulse cells remain guest-editable **while paused**. While live, the feed owns B50/C50. Other cells unchanged. |
| Contradiction vs undo | Ticks bypass undo; guest edits do not. Stated in table above — not “both on one stack”. |
| Ambiguity: monthly vs annual revenue | Seed may attach the index to 2026 annual and/or monthly columns; **must not** attach independent noise per month. One pair of indices per tick. |
| Scope creep into stock game | Explicitly excluded. |
| Schema 1 custom revenue formula | Do not rewrite it; only fill empty pulse addrs. Statements follow the pulse only after 恢复示例表 or a guest formula that reads B50/C50. |
| B52 vs `liveTick` | `liveTick` is the workbook field. B52 is optional display. Missing B52 is not a bug. |
| Two timers (rAF + interval) | Forbidden. One 5s interval. Recalc stays synchronous in that callback. |
| Dark theme unreadable flash | `pulseFlash` overlay uses existing ledger contrast tokens, not `cell.fill`. |

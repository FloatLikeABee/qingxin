# 便利店经理 longer shift (approved t275u 2026-11-21)

**Approved to implement.** Approach **B: 1800 ticks / 3:00 wall at 1×**. Actions (pick, pay, patience, spawn interval, order delay) **unchanged**. Not 上班 `DAY_TICKS`.

## Loop

- `STORE_SHIFT_TICKS = 1800`, `STORE_TICK_MS = 100` (existing rAF accumulator). HUD `3:00` → `0:00`.
- Enough real buy / restock / sell cycles because the shift is longer, not because shoppers are slower.
- Pause still freezes ticks. Restart still a full 1800-tick shift. Best-score save `qingxin.games.convenient-store` unchanged.

## Out of scope this batch

Cloud, shelf, cargo, annual report, operation, Stage 2/3, catalog-card restyle.

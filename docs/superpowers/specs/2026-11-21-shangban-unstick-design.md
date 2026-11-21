# 上班 unstick (approved as bugfix 2026-11-21)

Direct user report: jobs/progress/actions stall after 开始干活. This is a repair of the **already approved** workday loop (`docs/superpowers/specs/2026-11-19-shangban-workday-design.md`). Not Stage 2 career/social. Store/tide/cloud/shelf designs stay pending.

## Root causes (reproduced in unit tests before the fix)

1. **Overnight break freeze.** `breakUntil` was an absolute tick. A late-day rest (`tick 700` → `breakUntil 740`) survived `beginNextDay` (`tick = 0`), so the next morning could not walk or start work for most of the day.
2. **Inert 开始干活.** Start away from the desk only set a notice. The bar stayed at 0% while the clock ran. `pendingWork` was courier-only and was cleared even when interact missed.
3. **Submit required a second click.** Checkpoints (`报价` / `写测试` / `通过` / `调人`) ran before the bar filled, then did nothing at 100% until the same button was pressed again. Spec already said submit uses the stored choice.
4. **Narrow workstation.** Finance 报销盘 (and sales 投诉台 / manager 预算板) did not count, so progress froze at a valid desk.

## Fix (existing loop, no new career systems)

- Clear `breakUntil` on close / next day; clamp leftover breaks on schema-2 load.
- `requestStartWork` paths to the required stand (and waits for the elevator); arrival auto-starts. Dock shows 去工位开始 / 回到工位 with `data-block`.
- Store `pendingAction` and `flushPending` when the bar + checkpoints are ready. 提交 remains if nothing is stored.
- Alias stations per the workday spec. Tick still only advances at a workstation, on break, pause, hidden tab, 1x/2x/3x unchanged.
- Persist `pendingAction`. If an old save dropped it, `tickJob` still submits a stored sales quote / ship plan at 100%.
- Animation frames credit real elapsed time up to `MAX_STEP_MS` (250ms). The old 50ms rAF clamp made 1x days take ~129s and timed out day 2 while the clock was still in 上午.
- Calling the elevator clears a leftover walk path so arrival does not drag the player off the new floor.
- E2e `startJob` waits for **natural** progress (no `advanceJob` fill) and dismisses 收工 so a 3x day can continue. Natural 1x test plays two real days.

Saves: same `qingxin.shangban` schema 2. Invalid leftover `breakUntil` repaired; `pendingAction` round-trips. Other keys untouched.

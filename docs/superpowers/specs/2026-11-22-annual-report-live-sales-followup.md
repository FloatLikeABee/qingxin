# 年报 follow-up (approved, not a v1 spec)

**Status:** approved follow-up in the same 年报 workstream. **Not** ready to implement. Parent will prioritize the backlog and request a written spec for review at the brainstorming gate, then plan / implementation.

**Do not edit Annual Report production code on the cloud left/right checkpoint.** Cooking / Hospital remain queued later. This file only records the approval and forthcoming design constraints.

## Approval

| Field | Record |
| --- | --- |
| Request | t282u 2026-11-22: 年报 numbers change every 5 seconds to simulate real-life sales |
| Parent proposal | Simulated **sales inputs** drive linked revenue / profit / assets / cash together — not independent random formula cells. Brief changed-cell highlight. Pause for editing. Preserve formulas and saved work. |
| User widget | 2026-11-22 16:30: *Approved. Add five-second simulated sales with linked recalculation, highlights, and pause controls.* |

## Forthcoming spec must define (constraints)

- No formula overwrite.
- No edit collision with the 5s tick.
- Only **one** 5s timer; pause on hidden / unmount; **no catch-up burst**.
- Seeded, bounded **fictional** sales — not real data.
- Preserve ledger light / dark contrast.
- Saved live values / settings, and **undo vs editing** semantics, stated clearly.
- Coherent accounting across the three sheets (income, balance, cash).
- Linked recalc from underlying sales inputs, not per-cell noise.
- Brief highlight on changed cells; pause controls for editing.

Next: written spec for parent review. Not this run.

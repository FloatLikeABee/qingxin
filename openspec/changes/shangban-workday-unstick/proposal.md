# Change: 上班 workday unstick

Repair stalled jobs/progress in the approved workday loop. Not a redesign.

## Why

Guests could click 开始干活 and watch the clock move while the bar stayed at 0%, or finish the bar and sit on 可以交了 until they pressed the same action again. A late rest could freeze the next morning.

## What

- Overnight break does not block the next day.
- Start work walks to the desk and begins; blockers are labeled (`data-block`).
- Checkpoint choices submit when progress is ready (no second-click trap), including after reload.
- Finance/sales/manager side desks count as workstations.
- 1x days credit real frame time up to the hitch cap, so 18:00 is not delayed by a 50ms rAF clamp.

## Out of scope

Store/tide/cloud/shelf designs, Stage 2 career/social, auth, merge/Mac.

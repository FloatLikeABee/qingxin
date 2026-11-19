# Design: 上班 workday

Keep Stage 1 roles, floors, payloads, guest `qingxin.shangban` key, and AppShell hidden on `/modules/shangban`.

New units: `day.ts`, `jobs.ts`, `npc.ts`, `logs.ts`, `camera.ts`. `sim.ts` ticks those units. Persist schema 2 migrates 1. `ShangbanPlay.svelte` is a scene/rail layout, not a resurrected app sidebar.

Durations: `TICK_MS=100`, `DAY_TICKS=720` (72s real at 1x). Job ticks: courier 48, sales 90, tech 80, engineer 180, finance 72, manager 88, ceo 140. Speed 1/2/3. Log cap 14.

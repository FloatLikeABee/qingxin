# Design

## Context

`AppShell` already hosts `.qx-nebula` spans and `SpaceDust` when `!isPlayView`. `dust.ts` is outward cluster motes. `layout.css` animates three blurred circles. Glass, fixed top bar, and theme persistence stay.

## Decisions

1. **Enrich the existing field, do not add a second background stack.** Waves/stars live in `dust.ts` + CSS nebula. Hyperframes maps onto those files.
2. **Canvas 2D unless Hyperframes requires otherwise.** No paid CDN. WebGL only if the forwarded source requires it and it still unmounts on play views and disposes.
3. **Stars are depth, not twinkle.** Slow or static points. No per-frame opacity strobe.
4. **Theme is appearance, not a forced mode.** Dark is the cosmic presentation; light stays dawn; never write `qingxin.theme` on load.
5. **Play views stay empty of shell atmosphere.** `/modules/shangban`, `/modules/jimutai`, `*/play`.

## Gate

Do not code the field until parent forwards the official Hyperframes skill/source. Then modern-web-guidance search/retrieve, then TDD.

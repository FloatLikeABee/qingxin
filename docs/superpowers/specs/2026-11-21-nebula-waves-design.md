# Flowing blue-violet nebula waves (approved 2026-11-21)

Ge approved: **Build flowing blue-violet nebula waves with drifting particles, stars, and soft light over near-black. Keep motion calm and glass panels readable.** This records that design against the live Qingxin tree. No further approval pause. Hyperframes is the requested implementation guide; parent is locating the official skill/source and will forward it. **Do not implement until that source arrives.**

Workstream: extend open PR 37 on `cursor/shangban-stage1-4e4e`. Keep space-glass chrome, fixed top bar, hidden scrollbar chrome, 上班 workday, 积木台, catalog games, retired modules, and all user saves/theme. Do not merge, deploy, or Mac-edit. Parent auto-syncs verified commits.

This is a **shell background** upgrade only. It is not a new product, not a theme-mode removal, not 上班 Stage 2.

## Player fantasy

The app sits in a near-black night. Layered blue-violet nebula **waves** drift slowly behind the glass — not three round blobs, not a flat charcoal fill, not a disco starfield. Fine particles drift. Distant stars sit at different depths. Soft light accents breathe. Motion is clearly alive and still calm. Glass boards, the top bar, and type stay readable.

If dark mode is still only silver-blue outward motes on `#070b14` with circular `qx-nebula-a/b/c` washes, this failed. If glass text washes out, if anything flashes, if light theme breaks, or if a saved `qingxin.theme` is overwritten, this failed.

## What exists today (inspect, 2026-11-21)

| Layer | Live behavior |
| --- | --- |
| Page fill | `--qx-bg` `#070B14` dark / `#EAF3FF` light (`theme/resolve.ts`, `layout.css`) |
| CSS nebula | `.qx-nebula` radial washes + three blurred **circles** (`#93c5fd`, `#64748b`, `#60a5fa`) animating `qx-disperse` 28–42s |
| Canvas | `SpaceDust.svelte` + `dust.ts`: 36 motes (24 if width < 500), 4 expanding clouds, **outward** cluster drift, silver-blue, ~24 fps, DPR cap 1.5 |
| Mount | `AppShell` mounts nebula + dust only when `!isPlayView(pathname)` |
| Play skip | `isPlayView`: `/play`, `/modules/shangban*`, `/modules/jimutai*` |
| Pause | `document.hidden` stops rAF; `prefers-reduced-motion` paints one static frame (`data-anim=0`); `prefers-reduced-transparency` hides canvas |
| Chrome | `.qx-glass` / `.qx-glass-field`, full-width board, no sidebar, `position: fixed` top bar, scrollbar chrome hidden |
| Theme | Key `qingxin.theme`, default `system`, never written on guest load |

Nov 18 space-dust explicitly said **not a twinkling starfield**. Nov 21 **does** want star **depths** plus wave nebula. Stars must be calm points of light, not sparkle/flash.

## Approved look

### Dark appearance (the ask)

- Near-black page: keep `--qx-bg: #070b14` (do not retint to purple-black that fights glass).
- **Waves:** at least two layered blue/violet bands that translate/undulate slowly (tens of seconds per cycle). Horizontal or diagonal flow, not orbiting orbs.
- **Nebula:** soft color fields in blue (`#3B82F6` / `#60A5FA` family) and violet (`#7c6bff`–`#a78bfa` family), mixed in oklab, low alpha so glass still reads.
- **Particles:** drifting motes, mostly along the wave, not only exploding from three clusters.
- **Stars:** two depths (far smaller/dimmer, near slightly larger). Drift or parallax is optional and must be slower than particles. No twinkle that changes opacity every few frames.
- **Soft light:** one or two large low-intensity accents (no hard hotspots, no bloom that blows out the top bar).
- Cadence: clearly moving when watched 2–4 seconds; no strobing. Target ≤ ~24 fps for the canvas field (reuse `DUST_FPS` / skip-frames). Report measured `data-cadence`, never a fake FPS overlay.

### Light appearance (compatibility)

- Keep dawn `--qx-bg: #eaf3ff`. Waves/particles exist but quieter (lower alpha, cooler blue, almost no violet).
- Glass stays frosted white. Do not make light mode a second cosmic product.
- Settings 外观 (`light` / `dark` / `system` / `night-only`) stay. **Never** `setItem('qingxin.theme', …)` on load. Guest e2e that finds `qingxin.theme === null` must still pass.

### Readability

- Body and board text on `.qx-glass` remain ≥ 4.5:1 against the **effective panel color** (same measurement style as `space-glass.e2e.ts`).
- Dust/nebula `pointer-events: none`, `aria-hidden`, `z-index: 0` behind `.z-10` chrome.
- No particle overlay in the accessibility tree.
- Toast stays solid.

## Motion and environment

| Signal | Required |
| --- | --- |
| `prefers-reduced-motion: reduce` | No rAF, no CSS keyframes. Paint **one** attractive still (waves frozen mid-composition + stars + wash). `data-anim=0`. Glass falls back opaque as today. |
| `prefers-reduced-transparency: reduce` | Hide canvas; still nebula wash only; glass opaque. |
| `document.hidden` | Cancel rAF; resume on visible without a catch-up burst. |
| Play views | Do **not** mount nebula DOM or canvas. Three.js games keep their own sky. |
| Resize / DPR | Recreate field on resize; DPR `min(devicePixelRatio, 1.5)` (or Hyperframes cap if stricter). Dispose rAF, listeners, observer on destroy. |
| Narrow | ≤24 particles under 500px width. Cloud/wave count stays small (2–4). |
| No extra WebGL | Default remains canvas 2D + CSS. A Hyperframes WebGL path is allowed only if the forwarded source requires it, it is free, it disposes, and it still unmounts on play views. **No paid installs, no new npm packages unless Hyperframes is that package and parent explicitly includes it.** |

## Preserve (non-negotiable)

- App-wide chrome-glass bento, full width, no sidebar, no bottom tabs.
- Fixed top bar + `--qx-topbar-offset` + hidden scrollbar chrome (wheel/trackpad/keyboard still scroll).
- `isPlayView` policy. Do not run the shell field on 上班 / 积木台 / `*/play`.
- 上班 workday sim, logs, schema 2; 积木台; garden/store/shooter worlds.
- Save keys: `qingxin.theme`, `qingxin.session`, `qingxin.shangban`, `qingxin.jimutai`, `qingxin.privacyConsent`, elder flag. No auth/backend/account changes.
- Qingxin blue tokens. zh-CN.

## Hyperframes gate

User asked to install/use the Hyperframes skill. It is **not** in this workspace yet. Parent will forward the official source.

Until that follow-up:

1. Spec + plan only.
2. No field rewrite, no CSS wave rewrite, no new canvas renderer.
3. Implementation's first code step, once unblocked: read the forwarded Hyperframes skill/source, then modern-web-guidance search/retrieve, then TDD.

If Hyperframes conflicts with a preserve rule (play-view skip, no paid install, theme key, contrast), **preserve wins**; note the conflict in the PR, do not silently drop glass or force dark.

## Surfaces

| Surface | Change |
| --- | --- |
| `dust.ts` / `dust.spec.ts` | Wave/star/particle field (names may become nebula; keep `shouldAnimateDust` semantics) |
| `SpaceDust.svelte` | Paint waves + depths; keep pause/unmount/data-anim/cadence |
| `layout.css` `.qx-nebula*` | Replace circular orbs with layered wave washes; reduced-motion still |
| `AppShell.svelte` | Keep mount-only-when-not-play; no chrome re-architecture |
| `theme/resolve.ts` | Dark bg stays `#070B14`; no new default mode |
| e2e `space-glass.e2e.ts` + focused nebula e2e | Animation-over-time, reduced-motion, play skip, light+dark screenshots |

## Out of scope

Auth, backend, account, merge, deploy, Mac edits, CI subscriptions, fanout agents, extra paid installs, forcing dark for all users, restyling Three.js worlds, new modules, 上班 design changes.

## Failure pictures

- Flat near-black with a few dots.
- Flashing stars or opacity strobe.
- Violet so strong that glass tiles look muddy or contrast < 4.5:1.
- Light theme missing or broken.
- Field still running on `/modules/shangban` or a `*/play` route.
- Guest load writes `qingxin.theme`.

# Space-dust chrome-glass shell (approved 2026-11-18)

Ge approved: **Yes, apply this space-dust chrome-glass design across Qingxin and remove the sidebar.** This records that design against the live Qingxin tree. No further approval pause. 上班 Stage 2/3, 潮汐呼吸, 云上散步, and 记忆货架 are not this change.

Workstream: extend open PR 37 on `cursor/shangban-stage1-4e4e` (head `33816227b70855d6cc69977cfa7a9df32505e2e0` at inspect). Keep 上班 Stage 1, 积木台, retired four modules, Secrets, and catalog games. Do not merge, deploy, or sync a Mac.

## Player fantasy

The app sits in a quiet charcoal night. Fine silver-blue dust drifts outward behind the glass. Module tiles are smoked chrome panels on a board. There is no left rail. You pick a module from the board, and a compact top bar takes you home, to the board, or to 我的.

If the background is a flat black with dots, or glass is a generic white blur on one hub screenshot, this failed.

## Navigation (approved)

- **Primary navigation is the module center board.** `/modules` is the board. Home (`/`) also shows that board after the greeting so entry is not an empty hallway.
- **No left sidebar.** No hamburger that reopens the old sidebar. No leftover `w-64` gutter.
- **No bottom tab bar.** That was the phone copy of the sidebar and would fight the board.
- **Compact glass top bar** on every non-play route: 轻心 (home), 模块中心, 我的. Logged-in and logged-out both see it. Login / register keep the top bar so people can leave.
- **Play routes** (`/play`, `/modules/shangban`, `/modules/jimutai`) hide the top bar so the game owns the viewport. Games keep their own 返回 / 返回模块中心.
- **上班** is a board tile, not a fourth chrome tab. Reachable from home heroes, the board, and deep links.
- **设计系统 /kit** stays under 我的, not in the top bar.
- Retired 本地生活 / AI效率工具箱 / 学习打卡 / 求职副业 stay retired. `/modules/create` drafts stay.

Destinations after removal:

| Was                  | Now                                          |
| -------------------- | -------------------------------------------- |
| Sidebar 首页         | Top bar 首页 → `/`                           |
| Sidebar 上班         | Board tile + home hero → `/modules/shangban` |
| Sidebar 模块         | Top bar 模块中心 → `/modules`                |
| Sidebar 我的         | Top bar 我的 → `/settings`                   |
| Sidebar 打开模块中心 | Top bar 模块中心                             |
| Phone bottom tabs    | Removed                                      |
| Kit                  | Settings row 设计系统                        |

## Theme (do not clobber)

- Storage key remains `qingxin.theme`. Modes remain `light` / `dark` / `system` / `night-only`.
- Default remains **`system`**. Do not write a theme on load. Do not force dark for everyone.
- **Dark appearance** is the cosmic presentation: deep charcoal `--qx-bg: #070b14`, silver-blue dust, smoked glass.
- **Light appearance** stays coherent: pale dawn `--qx-bg: #eaf3ff`, faint silver dust, white-smoked glass. Not a second product.
- Settings 外观 controls stay. `resolveAppearance` tests stay the source of truth for when dark applies.

## Dust

- Behind the app (`z-index: 0`, `pointer-events: none`, `aria-hidden`). Never intercepts focus or clicks.
- Canvas 2D motes + a few CSS nebula washes. **No extra WebGL renderer.**
- Layered: 4 slow dispersing cloud patches + 36 motes (24 on viewports under 500px). Motes drift **outward** from a few clusters, fade, and respawn near a cluster. Not a twinkling starfield. No huge luminous hotspots.
- Animate at about **24 fps** (skip frames; report measured cadence, never a fake FPS overlay).
- Pause when `document.hidden`. Pause and unmount the canvas on play views. `prefers-reduced-motion`: paint one static frame, no rAF. `prefers-reduced-transparency`: hide canvas, keep a still charcoal/dawn wash.
- Clean up rAF, resize, and visibility listeners on destroy.

## Chrome-glass

Shared class `.qx-glass` (and `.qx-glass-field` for inputs) — not a blanket `div { glass }`.

Dark smoked glass: translucent charcoal, silver-blue rim, inner specular line, backdrop blur. Light: frosted white with a cool rim. Text stays `--qx-text`. Fallback: opaque `--qx-card` when `backdrop-filter` is missing, `prefers-reduced-transparency`, or `prefers-reduced-motion`.

Use it on: Card, Button secondary, Input, Textarea, Modal, Drawer, Tabs track, compact top bar, game docks (already `.qx-glass`). Toast stays **solid** so status is readable. Native `<option>` / system pickers are not restyled.

Do **not** chrome-plate Three.js worlds. 上班 floors, 积木台 table, garden, store, shooter keep their own lighting. Only surrounding chrome / docks change.

## Surface inventory

| Surface                                                                                         | Change                                                         |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `AppShell.svelte`                                                                               | Remove aside + `nav.fixed`. Add top bar. Host dust.            |
| `layout.css`                                                                                    | Charcoal tokens, nebula, stronger `.qx-glass`. Drop busy orbs. |
| `nav.ts`                                                                                        | `TOPBAR` of three destinations.                                |
| `SpaceDust` + `dust.ts`                                                                         | Canvas field, pause rules.                                     |
| `Card`, `Button`, `Input`, `Textarea`, `Modal`, `Drawer`, `Tabs`                                | Glass classes.                                                 |
| Home `/`                                                                                        | Greeting + 积木台/上班 heroes + full module board.             |
| `/modules`                                                                                      | Same board, glass tiles.                                       |
| Settings, login, register, privacy, offline, kit                                                | Inherit primitives; kit still from 我的.                       |
| Mood, finance, elder, pets, wellness, secrets, create, games catalog, `[slug]`, retired notices | Inherit Card/Button; keep 返回模块中心.                        |
| Finance/Pets/Wellness inner nav pills                                                           | Glass chips, not opaque slabs.                                 |
| Shangban / Jimutai / Garden / Store / Shooter docks                                             | Token upgrade only; canvases untouched.                        |

## Bounds and a11y

- Top bar controls ≥ 44px. Focus rings stay `--qx-primary`.
- Contrast: body text on glass ≥ 4.5:1 against the effective panel color.
- No dust over game canvases. No particle overlay in the accessibility tree.
- Keyboard: Tab through top bar then board. Browser back and deep links unchanged.
- 390 / 768 / 1280 / 1600: no leftover left gutter, no horizontal overflow.
- Compact glass top bar is `position: fixed` to the viewport (not sticky inside a scrolling column). In-flow content and `scroll-padding-top` start below it so focus, anchors, and skip targets are not hidden.
- Page and existing overflow panels hide scrollbar chrome (`scrollbar-width: none` plus `::-webkit-scrollbar` fallback) while wheel, trackpad, touch, and keyboard scrolling keep working. Do not use `overflow: hidden` on `html`/`body` to fake that.

## Out of scope

No auth/backend changes, no data wipes, no new npm packages, no iOS, no 上班 Stage 2/3, no merge/deploy/Mac sync.

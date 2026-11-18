# Design

## Context

AppShell currently draws a `w-64` aside on `md+` and a `nav.fixed` four-tab bar on phones. Background is blurred color orbs. Cards are opaque `--qx-card`.

## Decisions

1. **Board is nav.** Module tiles on `/` and `/modules` replace chrome tabs for 上班 and other modules.
2. **Top bar of three.** 首页 / 模块中心 / 我的. Kit stays in settings.
3. **Canvas 2D dust, not WebGL.** Pause on hidden and on Three.js play routes so the shell never competes with games.
4. **Opt-in glass classes.** `.qx-glass` / `.qx-glass-field` on kit primitives. No `div { glass }`.
5. **Theme default stays system.** Cosmic charcoal is the dark appearance, not a forced mode.

## Play views

`/modules/shangban`, `/modules/jimutai`, and `*/play` hide top bar and unmount dust. Game worlds keep their own materials.

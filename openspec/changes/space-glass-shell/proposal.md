# Proposal

## Why

Ge approved a product-wide space-dust chrome-glass shell and the removal of the left sidebar. Navigation should live on the module center board plus a compact top bar.

## What Changes

- Deep charcoal (and coherent light) backdrop with slow dispersing silver-blue dust behind the app.
- Chrome-glass cards, fields, dialogs, top bar, and game docks via shared tokens.
- Remove desktop sidebar and phone bottom tabs. Compact top bar: 首页, 模块中心, 我的.
- Home and `/modules` show the module board. Theme persistence unchanged.

## Capabilities

### New Capabilities

- `space-dust`: bounded canvas-2D dispersing dust with pause and reduced-motion rules.

### Modified Capabilities

- `app-shell`: board + top bar; no sidebar/tabs.

## Impact

- Shell, kit primitives, home/hub, e2e nav assertions.
- No backend, auth, or save-key changes. No new packages.

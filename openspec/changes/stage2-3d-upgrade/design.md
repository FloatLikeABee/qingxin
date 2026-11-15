# Design

See `docs/superpowers/specs/2026-11-14-3d-games-upgrade.md`.

- Garden logic stays pure TypeScript. Three.js is a view.
- Store sim is frozen; render/HUD only.
- Schema 1 garden saves migrate in place.
- WebGL failure is explained and falls back to interactive DOM, not a screenshot.

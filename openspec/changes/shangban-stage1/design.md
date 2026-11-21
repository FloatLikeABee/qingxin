# Design

See `docs/superpowers/specs/2026-11-16-shangban-stage1-design.md` for the approved Stage 1 design (role/task table, caps, save key, navigation).

Decisions:

- Module, not a games-catalog entry, because the request is to replace the 内容创作 **entry**.
- Seven roles (not a longer advertised list) so every listed job is playable.
- Task math lives in `tasks.ts`; ticks/NPCs/elevator in `sim.ts`; Three.js only in `render.ts`.
- Legacy `/modules/create` kept; no destructive delete of M9 storage.
- Experimental canvas-html origin trial is not used; DOM twins + `aria-live` expose the scene.

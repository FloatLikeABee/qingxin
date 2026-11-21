# Design

See `docs/superpowers/specs/2026-11-17-building-sandbox-design.md`.

Decisions:

- Name 积木台 / `jimutai` as a first-class module, not a 上班 floor and not a games-catalog SKU.
- Inventory is physical tray slots, not an infinite palette. Refill is a whole batch of five.
- Placement is grid snap + face/ground adjacency. No rigid-body collapse.
- Undo is the reposition tool so batch accounting stays exact.
- Retired modules keep `lib/**` and HTTP maps; only interactive routes and entries go away.
- Gesture rule: movement > 10px or two pointers = camera, never place.

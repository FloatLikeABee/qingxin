# Spec: 手术 Operation game (lane R)

A fictional four-region surgical toy. Visual lane R (realistic graphic, including blood) is locked. This is entertainment, not medical training.

## Requirements

### Warning gate

- Play MUST show the exact content warning and CTA `我已知晓，进入手术` before any graphic scene or audio.
- Direct `/play` and reload without `graphicAck` MUST re-show the gate. Catalog cover MUST NOT show wounds or blood.
- After acknowledgement, a small `含血腥` mark remains. Persist `graphicAck` so the blocking modal does not repeat, but mid-procedure state is NOT restored onto a graphic field.

### Four regions

- Playable: 前臂, 膝, 口腔, 腹. Other body parts are `未开放` only — never advertised as full anatomy.
- Phase loop per region: 准备 → 显露 → 操作 → 止血/冲洗 → 关闭.
- Tools act in the scene (cut, pick, suction, irrigate, pressure/gauze, suture/pack). Illegal tools notice and no-op.
- Blood rises on opening/slip, falls on suction/pressure, stops on close. Reduced motion removes camera lunge and spray particles, not blood film/pools.
- Mistakes restart the current phase, not the whole body. Replay and new seed are always available after complete.

### Persist

- Key `qingxin.games.operation` schema 1. Do not write sibling game keys or `qingxin.theme`.

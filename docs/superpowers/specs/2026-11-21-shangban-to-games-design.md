# 上班 → Games catalog (implemented 2026-11-21)

User asked to **move first**, then design three unrelated games later. This is the relocation only.

## Desired IA

上班 is a playable card in 轻心游戏. It is not a top-level hub module. Gameplay, `/modules/shangban` deep links, `qingxin.shangban` schema 2, and the unstick repairs stay.

## Shipped shape

| Surface | Behavior |
| --- | --- |
| Catalog | id `shangban`, 经营, 开始上班, office cover |
| Play | `/modules/games/shangban/play` mounts `ShangbanPlay` |
| Legacy | `/modules/shangban` → 301 `/modules/games/shangban/play` |
| Hub | no `data-board-tile="shangban"` |
| Home | 上班 hero + 去上班 still uses the legacy href |
| Shell | `isPlayView` for legacy + `/play`; 返回目录 |
| Save | `qingxin.shangban` unchanged |

Out of scope: Stage 2/3, new games, store/tide/cloud/shelf, auth/theme, merge/Mac.

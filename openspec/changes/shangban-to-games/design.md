# Design: 上班 in Games

## Decision

Keep `id: shangban` so the catalog path matches the save key and the old slug. Mount `ShangbanPlay` from the existing games play switch. Do not move `web/src/lib/shangban`.

## Deep links

`/modules/shangban` stays as a dedicated route whose `load` issues `redirect(301, '/modules/games/shangban/play')`. In-app home/create links may keep that href. `isPlayView` still treats the legacy path as play in case of a brief landing.

## Catalog

Cover motif `office` is a five-floor CSS silhouette. Featured game remains 便利店经理.

## Save

`SHANGBAN_SAVE_KEY` stays `qingxin.shangban`. No migration, no second key.

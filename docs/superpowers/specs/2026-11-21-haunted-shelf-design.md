# 记忆货架 haunted bookshelf (approved t275u / t271u 2026-11-21)

**Approved to implement.** Replaces the memory / correctness / veil puzzle. Catalog **card art stays**. Route `/modules/games/memory-shelf` and save key `qingxin.games.memory-shelf` stay.

## Fantasy

One **big fancy** walnut bookcase, packed with varied 3D books, small souvenirs, and antiques. Cozy, funny. Free pick up and rearrange with mouse and 390 touch. **Not** a memory test, not a veil, not a collection-room unlock.

## Haunt

Exactly **one** hidden haunted **book** per round. When that book is picked:

1. Ghost pops **out** of that book.
2. Visible expressive face and exaggerated tears.
3. Visible **对不起！** (sorry, funny).
4. Sheepishly retreats into the **same** book.

The full timed sequence cannot retrigger and cannot spawn a second ghost. **下一轮** picks a new random haunted book; the arrangement persists.

## Controls

Pick/place on the canvas. Dock buttons do not duplicate grab/drop. 44px targets. Audio opt-in. Reduced-motion still shows emerge → cry → apology → return, shorter.

## Save

Schema **2** reads schema **1**: keep `lowDetail` / `audioWanted` / `dockCollapsed`; start a fresh fancy shelf; notice 「货架换了样子，书还在等你摆。」 Other `qingxin.*` keys untouched.

## Performance / honesty

High: 4×7 cells (~22 books + souvenirs). Low-detail: 3×5, fewer lights. Procedural spines, no scanned covers, no voice acting (opt-in whimpers). One bookcase, not a house.

# 记忆货架 haunted bookshelf delta

## Requirement: One fancy free-arrange bookcase

Play SHALL be one big 3D bookcase of mixed books and souvenirs. Guests pick up and place items with pointer / 390 touch. There is no veil, memory restore, hint, or collection room.

### Scenario: Rearrange a book
- **WHEN** a guest picks a non-haunted book and drops it on another slot
- **THEN** those two items swap and the rest of the arrangement stays

## Requirement: One haunt sequence per round

Exactly one book is haunted. Picking it plays emerge → face → cry → 对不起！ → retreat into the same book. The sequence cannot retrigger this round. 下一轮 chooses a different random book; placements persist.

### Scenario: Apology then done
- **WHEN** the haunted book is picked
- **THEN** a visible ghost face with tears and 对不起！ appears, then the ghost returns to that book and `phase` is `done`

### Scenario: Next round
- **WHEN** the guest presses 下一轮 after `done`
- **THEN** `hauntId` changes, `phase` is `idle`, and item rows/slots match the previous arrangement

## Requirement: Schema 2 reads schema 1 without wipes

`qingxin.games.memory-shelf` schema 2 SHALL keep lowDetail, audioWanted, and dockCollapsed from schema 1 and start a fresh shelf with 「货架换了样子，书还在等你摆。」 Other `qingxin.*` keys stay untouched.

### Scenario: Theme and tide survive
- **WHEN** a schema 1 puzzle save is loaded beside an existing theme key
- **THEN** the rewrite is schema 2, settings remain, and theme is unchanged

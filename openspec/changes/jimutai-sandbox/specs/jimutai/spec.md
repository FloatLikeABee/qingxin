# jimutai Specification

## Purpose

A guest-playable Three.js construction sandbox. Small pieces, five at a time, no win or lose.

## Requirements

### Requirement: Five-piece batches

A fresh table SHALL put exactly five usable pieces in the tray. The next five SHALL appear only after those five have been placed. Invalid placement SHALL NOT consume a tray slot.

#### Scenario: Refill after the fifth place

- **WHEN** the guest places the fifth piece of the current tray
- **THEN** the tray contains five new pieces and the placed count is 5 (or 5 more than the previous batch)

#### Scenario: No per-place restock

- **WHEN** the guest places the first piece of a fresh table
- **THEN** the tray contains four pieces, not five

### Requirement: Connected small pieces

Pieces SHALL be the six small shapes 方块 / 长条 / 立柱 / 弯角 / 平板 / 台阶. Placement SHALL snap to a 16×16×12 cell volume, reject overlaps and floating pieces, and allow ground or face attachment. Every batch SHALL include a 方块.

#### Scenario: Overlap is free

- **WHEN** a ghost overlaps an occupied cell and the guest taps to place
- **THEN** the tray is unchanged

### Requirement: Undo across a refill

Undo SHALL restore tray, placed pieces, rotations, and batch index. Undoing the placement that granted a refill SHALL discard that refill.

#### Scenario: Undo the fifth piece after refill

- **WHEN** five pieces are placed (tray refilled) and the guest undoes once
- **THEN** the tray holds the fifth piece only and the refill pieces are gone

### Requirement: Guest save

Progress SHALL persist in `qingxin.jimutai` schema 1, including tray, placed pieces, rotations, camera, and undo. Corrupt JSON SHALL recover a playable table without deleting other localStorage keys.

#### Scenario: Corrupt save

- **WHEN** the save key contains invalid JSON
- **THEN** the game loads a fresh table with `recovered` true and sibling save keys remain

### Requirement: Camera does not place

Orbit, pan, and zoom SHALL NOT place a piece. A primary pointer SHALL place only when movement is under 10px and a single pointer was used.

#### Scenario: Drag to look

- **WHEN** the guest drags the canvas more than 10px
- **THEN** the placed count does not change

### Requirement: Reset confirms

Clearing the table SHALL require an explicit confirm. Cancel SHALL leave the build in place.

### Requirement: Documented bounds

The table SHALL cap at 80 placed pieces on a 16×16×12 grid. UI copy SHALL NOT claim an infinite world.

### Requirement: Fallback

When WebGL fails, a 2D top-down grid SHALL still place, rotate, undo, and save using the same world object.

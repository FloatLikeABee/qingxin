# store-manager Specification

## Purpose
Runs 便利店经理 as a complete browser-only convenience-store shift: a testable stock/shopper/checkout simulation and a Three.js three-quarter view with mouse and touch controls.

## Requirements

### Requirement: Simulation without WebGL
Core store logic SHALL live in pure TypeScript: SKUs with prices and restock costs, shelf stock, back-room storage, shoppers who visit shelves then checkout or leave, and a day/shift timer that yields revenue, leftover stock, and satisfaction. Unit tests SHALL run this logic in Node without importing `three`.

#### Scenario: Restock from storage
- **WHEN** a shelf has space and storage holds that SKU
- **THEN** restocking moves units from storage onto the shelf and does not increase total units

#### Scenario: Sold out shopper
- **WHEN** a shopper reaches a shelf with zero stock for a listed SKU
- **THEN** that item is not taken and the shopper is marked disappointed

#### Scenario: Checkout pays
- **WHEN** a shopper with a non-empty basket finishes checkout
- **THEN** cash and revenue increase by the sum of item prices and shelf stock for those items stays reduced

#### Scenario: Long wait
- **WHEN** a queued shopper waits beyond patience
- **THEN** they leave unhappy and do not pay

#### Scenario: Order into storage
- **WHEN** cash covers a crate
- **THEN** cash decreases immediately and storage increases when the order arrives

### Requirement: Playable 3D shift
`/modules/games/convenient-store/play` SHALL mount a Three.js canvas of a stylized convenience store (readable three-quarter or isometric view, Qingxin-palette lighting, not default gray cubes). Simulated shoppers SHALL walk aisles, try shelves, queue, and leave. The player SHALL restock shelves from storage and order crates into storage using mouse and touch. A shift SHALL end with a result showing revenue, leftover stock, and customer satisfaction. Controls SHALL include 暂停 and 重新开始. No account SHALL be required. Optional `localStorage` MAY remember best day / last settings only.

#### Scenario: Canvas and chrome
- **WHEN** a user opens the play route with privacy consent
- **THEN** a canvas is visible together with 返回目录, 暂停, and a cash readout

#### Scenario: Touch-sized actions
- **WHEN** the viewport is 390px
- **THEN** restock and order controls are visible in an on-page HUD (not only as tiny 3D picks)

### Requirement: Frontend only
The game SHALL NOT call Qingxin API save endpoints. Ending a day SHALL NOT require login.

#### Scenario: Guest can play
- **WHEN** a user with privacy consent but no session opens the play route
- **THEN** the canvas still mounts

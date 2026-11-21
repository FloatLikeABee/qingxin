# space-dust delta (nebula waves)

## Requirement: Flowing nebula waves behind chrome

The shell background SHALL show layered blue-violet nebula waves, drifting particles, and star depths over near-black in dark appearance, and a quieter dawn-compatible field in light appearance. Motion SHALL be calm (no flashing). Glass panels SHALL remain readable (≥ 4.5:1 on `.qx-glass`). The field SHALL NOT run on play views. `qingxin.theme` SHALL NOT be overwritten on load.

### Scenario: Dark hub is a wave nebula, not circular orbs only

- **WHEN** a guest opens `/modules` at 1280px with theme `dark` and motion allowed
- **THEN** `[data-qx-dust]` is present with `data-anim=1`, body background is near `#070b14`, and two screenshots 1.2s apart differ without a full-frame blink

### Scenario: Play views have no shell field

- **WHEN** the user opens `/modules/shangban` or a `*/play` route
- **THEN** `[data-qx-dust]` is absent and `.qx-nebula` is not mounted

### Scenario: Reduced motion is a still nebula

- **WHEN** `prefers-reduced-motion: reduce`
- **THEN** `[data-qx-dust]` has `data-anim=0` and the still frame is not a flat fill

### Scenario: Theme preference is untouched

- **WHEN** a guest with no `qingxin.theme` loads `/`
- **THEN** `localStorage.qingxin.theme` remains unset

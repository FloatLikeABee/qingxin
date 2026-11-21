# 年报 (proposal only — not approved, do not implement)

Independent **game** inside Qingxin. Not Excel automation, not an external document, not a Page, not a real-company workbook.

**Status:** design for parent approval. Do not implement until Ge approves this spec.

## Player fantasy

You sit in a polished in-app spreadsheet and **make** a fictional company's annual report. Income statement, balance sheet, and cash-flow already have many rows. You change assumptions and numbers; dependent formulas update. You can select, type, move with the keyboard, copy/paste, undo, switch sheets, and apply light formatting. The point is agency in a dense workbook, not watching a PDF.

If it is a static infographic with three sliders, it failed. If it claims to be Microsoft Excel / 365 or writes a real `.xlsx` to a cloud office suite, it failed. If the company is presented as a real listed firm, it failed.

## Labeling (non-negotiable)

Visible on detail and play: **本表是游戏里的虚构公司数据，不是真实财报，也不连接 Excel。** Generated names, figures, and ISIN-looking codes are fake. Suggested company: **青柠示意有限公司** (clearly toy). Do not use a real ticker or a living firm's statements.

## What exists today

| Layer | Live behavior |
| --- | --- |
| Catalog | No `annual-report` id |
| Spreadsheet | None. Finance module is personal bills, not a workbook |
| Formula libs | Not installed. Context7 MCP is unauthenticated this session — feasibility below is from known MIT/Apache engines, not a live docs fetch |
| Pattern | Guest localStorage games, glass chrome, 390 + 1280 |

Paid Excel, Office 365, and uninstalled spreadsheet runtimes are **not** used.

## How much “Excel” is actually feasible in v1

Honest ceiling for a Qingxin catalog game (bundle, a11y, guest-only):

| Feature | v1 | Later / never in v1 |
| --- | --- | --- |
| Grid, sheets, formula bar | Yes | — |
| Arithmetic `+ - * / ( )` | Yes | — |
| A1, $A$1, `假设!B4` | Yes | 3D refs, structured tables |
| SUM AVERAGE MIN MAX IF ROUND ABS | Yes | XLOOKUP, INDEX/MATCH, ARRAY, LAMBDA, pivot |
| Circular ref | Detect + notice, no calc | Iterative calc |
| Selection, arrows, Tab/Enter | Yes | Excel-complete names box |
| Copy/paste TSV (internal + OS clipboard) | Yes | Excel XML clipboard |
| Undo/redo ~50 | Yes | Infinite |
| Number / % / 2-dec / bold / fill | Yes | Conditional formats, merged hell, freeze panes maybe one header row |
| Charts | One simple bar from a selected range **or** skip | Excel chart engine |
| Import/export `.xlsx` | No (implies Office) | Maybe CSV download labeled 游戏导出 |
| VBA / add-ins / copilot | Never | — |

**Engine choice (recommend custom DAG, optional HyperFormula later):**

### A. Pretty report + sliders (reject)

Looks finished, no grid agency. Fails “spreadsheet UI” and “make the report they want.”

### B. Qingxin grid + small formula DAG (recommend)

Own the DOM grid (virtualized rows). Formulas compile to a DAG; dirty cells recalc. Fits tokens, 390 scroll, unit tests without a 1MB grid kit. We **do not promise all of Excel**; we promise the table above.

### C. Embed Univer / Luckysheet / Handsontable + HyperFormula (defer)

Real spreadsheet muscle, large JS, theme fight, keyboard/a11y unknown, possible paid editions. Do not take a paid SKU. If Ge later wants closer Excel parity, HyperFormula (MIT) can replace the DAG **without** claiming Excel.

**Recommendation:** B for v1. Document the formula list on the detail page so the product is honest.

## Recommended v1 playable loop

1. Catalog: id `annual-report`, title **年报**, englishTitle **Annual Report**, category **经营**, tags `表格, 虚构, 财务`, playCta **打开年报**.
2. Play `/modules/games/annual-report/play`. Dense workbook, not a marketing Page. Chrome: 返回目录, 虚构标记, sheet tabs, formula bar, 撤销 / 重做.
3. Four sheets with **many rows of content** (not 12 empty cells):
   - **假设** — growth, COGS %, tax rate, headcount, capex (editable drivers).
   - **利润表** — revenue through net income, YoY, several cost lines.
   - **资产负债表** — assets / liabilities / equity that **tie** (assets = liab + equity) when formulas are intact.
   - **现金流量表** — operating / investing / financing from the above.
4. Guest may overwrite any value or formula. Insert-row allowed up to a cap (200 rows/sheet). Structural title rows can be edited but a **恢复示例表** resets to the fictional seed (does not wipe other Qingxin keys).
5. Selection: click/drag, shift-arrows, fill handle **not** required in v1. Keyboard first on 1280; on 390, tap cell then a docked editor + numeric keys, sheets in a horizontally scrollable tab bar (min 44px).
6. Copy/paste: internal selection and `text/plain` TSV. Undo stack in memory (not required on disk).
7. Win state: none. The game is the workbook. Optional gentle notice when the balance sheet still ties after your edits.

## Interaction systems

| System | v1 contract |
| --- | --- |
| Grid model | `{ sheets: { id, name, rows, cols, cells: Record<addr, { raw, numFmt?, bold?, fill? }> } }` |
| Parser | Tokenize `=SUM(A1:A10)+假设!B2` ; unknown fn → `#NAME?` ; div0 → `#DIV/0!` ; cycle → `#CYCLE!` |
| Recalc | Topo order; cap iterations; dirty set. Pure functions, Vitest without DOM |
| Clipboard | `navigator.clipboard` when permitted; fallback `execCommand` not required if clipboard API exists |
| Screen reader | Active cell `aria-activedescendant`; formula bar labeled |

## Save / performance

- Key `qingxin.games.annual-report`, schema 1.
- Persist sheets + named company title + `dockCollapsed`. Undo stack not persisted.
- Size cap: reject/clamp if serialized workbook > ~400KB. Corrupt → recovered **seed workbook** + notice; sibling keys untouched.
- Virtualize rows so 150×20 does not mount 3000 DOM nodes. Recalc budget: one frame; defer deep graphs with a `data-dirty` flag.

## Test acceptance (when implemented)

- Unit: SUM/IF/sheet refs; cycle; assumption change updates 利润表 net income; tie identity holds on seed data; clamp/corrupt recover.
- Playwright: disclaimer visible; edit 假设 growth; dependent total changes; arrow-key move; copy/paste a range; undo; switch sheets; 390 tap-edit; 1280 formula bar; 返回目录. No network calls to Microsoft. Other games still open.

## Visual world (proposal)

Operate mode: a **game** ledger inside Qingxin glass — paper-warm grid, Outfit/Noto, primary blue selection, coral/gold for negative/highlight — not Excel’s grey clone and not a magazine annual-report microsite. Fancy and usable. Impeccable concept-seed **not** run.

## Out of scope until approval

Playable grid, formula engine, catalog card, `.xlsx`, real-company datasets, finance-module changes.

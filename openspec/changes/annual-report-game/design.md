# Design: 年报

See `docs/superpowers/specs/2026-11-21-annual-report-design.md`.

Qingxin-owned DOM table + formula DAG. Slider-PDF rejected. Univer/Luckysheet/HyperFormula not taken. Honest function list: `+ - * / ( )`, A1, `$A$1`, `假设!B4`, SUM AVERAGE MIN MAX IF ROUND ABS. Seed sheets render fully (~48×17). Cap 200×26; v1 does not window a 3000-node virtualizer.

Errors: `#PARSE!` `#NAME?` `#REF!` `#DIV/0!` `#CYCLE!` `#VALUE!`. No `eval`, no injection.

Four sheets 假设 / 利润表 / 资产负债表 / 现金流量表 share one DAG. Seed 勾稽 holds. Guest may overwrite any cell.

Impeccable Operate: paper-warm ledger, Outfit/Noto, primary-blue selection, coral negatives. No PRODUCT.md / concept-seed (approved brief). modern-web-guidance: sticky table headers + row labels, overflow auto both axes, no scroll-axis-lock, 44px tabs, `role="region"` scroll wrapper.

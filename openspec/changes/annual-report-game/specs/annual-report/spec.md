# 年报 delta

## Requirement: Formula DAG

The engine SHALL parse listed functions and A1 / sheet refs into a DAG, recalc in topo order, and surface `#PARSE!` `#NAME?` `#REF!` `#DIV/0!` `#CYCLE!` `#VALUE!` without `eval`.

### Scenario: Cross-sheet SUM and errors
- **WHEN** a cell is `=SUM(假设!B3:B5)+1`
- **THEN** it equals the sum of those inputs plus one
- **WHEN** a formula divides by zero, names an unknown fn, or cycles
- **THEN** the cell shows the matching error token

## Requirement: Linked fictional statements

Seed 假设 drivers SHALL flow into 利润表, 资产负债表, and 现金流量表. Intact seed SHALL keep 资产总计 = 负债和权益总计.

### Scenario: Growth edits three statements
- **WHEN** the guest changes 营收增长率 for 2025
- **THEN** 净利润, 资产总计, and 期末现金 all change without teleporting other Qingxin saves

# 年报 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: executing-plans inline; no reviewer fanout.

**Goal:** Playable in-app fictional workbook (青柠示意有限公司) with four linked sheets, a small formula DAG, real edit/recalc, and Qingxin glass chrome.

**Architecture:** Own DOM grid + tokenizer/DAG (Approach B). No HyperFormula, Univer, Handsontable, `.xlsx`, or Office. Formulas compile to an AST; recalc is topo-order with cycle/div0/name/ref/parse errors. Seed statements share one assumption sheet so one growth edit moves 利润表 / 资产负债表 / 现金流量表.

**Tech Stack:** SvelteKit 3, Vitest, Playwright. No new npm deps.

## Global Constraints

- Catalog id `annual-report`, title 年报, englishTitle Annual Report, category 经营, tags 表格/虚构/财务, playCta 打开年报
- Visible disclaimer on detail and play: 本表是游戏里的虚构公司数据，不是真实财报，也不连接 Excel。
- Company 青柠示意有限公司; fake ISIN-looking code; not a living firm
- Functions: `+ - * / ( )`, A1, $A$1, `假设!B4`, SUM AVERAGE MIN MAX IF ROUND ABS. Honest list on detail. Not Excel.
- Save `qingxin.games.annual-report` schema 1; ≤ ~400KB; corrupt → seed + notice; never wipe siblings
- Undo ~50 in memory only. Insert-row cap 200/sheet.
- 1280 keyboard-first; 390 tap + docked editor, 44px sheet tabs, sticky labels, horizontal scroll. No header overlap.
- No scroll-axis-lock. Table wrapper `overflow: auto`, `role="region"`, sticky thead/first column.
- Stack on cargo PR #44 from SHA `ad3e624`. No Mac/merge/main/DB. Not Operation R.

## File map

- Create `web/src/lib/games/report/{addr,parse,engine,book,seed,persist,ReportPlay.svelte}` + `*.spec.ts`
- Modify catalog, GameCover (ledger motif), play switch, games e2e, Icon if needed
- Create `web/e2e/annual-report.e2e.ts`
- Update `openspec/changes/annual-report-game/` and this spec status

## Tasks

1. TDD addr/parse/engine: arithmetic, listed functions, sheet refs, cycle/#DIV/0!/#NAME?/#REF!/#PARSE!, no `eval`.
2. TDD seed financial chain: change 假设 growth → 净利润 / 资产总计 / 期末现金 move; seed 勾稽差额 ≈ 0.
3. TDD undo/redo, TSV copy-paste with relative ref shift, persist clamp/corrupt.
4. ReportPlay: formula bar, grid, sheet tabs, format, 恢复示例表 confirm, 390 editor, two-row HUD.
5. Natural Playwright: disclaimer, edit assumption, three statements, paste+undo, formula error, format, sheets, reload, 390 scroll/edit, sibling boots.
6. check / full unit / build / e2e, stacked PR, STOP.

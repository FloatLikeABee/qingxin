<script lang="ts">
	import { browser } from '$app/env';
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import { a1, indexToCol } from './addr';
	import { applyEdit, copyTsv, formatSel, insertRow, pasteTsv, redoEdit, undoEdit } from './book';
	import {
		cellKind,
		displayCell,
		evaluateBook,
		getSheet,
		numeric,
		type NumFmt,
		type Workbook
	} from './engine';
	import { readReportSave, writeReportSave } from './persist';
	import { COMPANY, createSeedBook, DISCLAIMER, TIE_ADDR } from './seed';
	import { fillTone, sheetStyle } from './sheetTheme';

	let { title }: { title: string } = $props();

	let book = $state<Workbook>(readReportSave());
	let draft = $state('');
	let editing = $state(false);
	let confirmReset = $state(false);
	let darkSheet = $state(browser && document.documentElement.classList.contains('dark'));
	let wrapEl = $state<HTMLDivElement | null>(null);
	let headEl = $state<HTMLDivElement | null>(null);
	let formulaEl = $state<HTMLInputElement | null>(null);

	const sheet = $derived(getSheet(book, book.active) ?? book.sheets[0]!);
	const activeAddr = $derived(a1(book.selection.r0, book.selection.c0));
	const activeRaw = $derived(sheet.cells[activeAddr]?.raw ?? '');
	const tie = $derived(numeric(book, '资产负债表', `C${TIE_ADDR.row}`));
	const ni = $derived(numeric(book, '利润表', `C${TIE_ADDR.ni}`));
	const cash = $derived(numeric(book, '现金流量表', `C${TIE_ADDR.cash}`));
	const assets = $derived(numeric(book, '资产负债表', `C${TIE_ADDR.assets}`));
	const growth = $derived(numeric(book, '假设', 'C6'));
	const gridWidth = $derived(`calc(2.1rem + 9.5rem + ${Math.max(sheet.cols - 1, 1)} * 5.4rem)`);
	const sheetCss = $derived(sheetStyle(darkSheet ? 'dark' : 'light'));
	let dragging = $state(false);

	function save() {
		writeReportSave(book);
	}

	function paint() {
		evaluateBook(book);
		const gap = numeric(book, '资产负债表', `C${TIE_ADDR.row}`);
		book.notice =
			Number.isFinite(gap) && Math.abs(gap) < 0.05
				? '资产负债表仍勾稽。'
				: `资产负债表勾稽差额 ${Number.isFinite(gap) ? gap.toFixed(2) : '—'}。`;
		save();
	}

	function flushEdit() {
		if (!editing) return;
		const addr = a1(book.selection.r0, book.selection.c0);
		const current = getSheet(book, book.active)?.cells[addr]?.raw ?? '';
		if (draft !== current) {
			applyEdit(book, book.active, addr, draft);
			paint();
		}
		editing = false;
	}

	function select(r: number, c: number, extend = false) {
		flushEdit();
		const sel = book.selection;
		if (extend && sel.sheet === book.active) {
			book.selection = { ...sel, r1: r, c1: c };
		} else {
			book.selection = { sheet: book.active, r0: r, c0: c, r1: r, c1: c };
		}
		draft = getSheet(book, book.active)?.cells[a1(r, c)]?.raw ?? '';
		editing = false;
	}

	function commit(raw = draft) {
		applyEdit(book, book.active, a1(book.selection.r0, book.selection.c0), raw);
		editing = false;
		paint();
		draft = getSheet(book, book.active)?.cells[a1(book.selection.r0, book.selection.c0)]?.raw ?? '';
	}

	function switchSheet(name: string) {
		flushEdit();
		book.active = name;
		book.selection = { sheet: name, r0: 0, c0: 0, r1: 0, c1: 0 };
		draft = getSheet(book, name)?.cells.A1?.raw ?? '';
		editing = false;
		save();
		queueMicrotask(() => {
			if (wrapEl) wrapEl.scrollLeft = 0;
			if (headEl) headEl.scrollLeft = 0;
		});
	}

	function onInsertRow() {
		insertRow(book);
		save();
	}

	function syncHeadFromBody() {
		if (headEl && wrapEl) headEl.scrollLeft = wrapEl.scrollLeft;
	}

	function syncBodyFromHead() {
		if (headEl && wrapEl) wrapEl.scrollLeft = headEl.scrollLeft;
	}

	function onUndo() {
		undoEdit(book);
		paint();
		draft = activeRaw;
	}

	function onRedo() {
		redoEdit(book);
		paint();
		draft = activeRaw;
	}

	function onCopy() {
		const tsv = copyTsv(book);
		void navigator.clipboard?.writeText(tsv);
	}

	async function onPaste() {
		const text = (await navigator.clipboard?.readText?.()) ?? '';
		if (text) {
			pasteTsv(book, text);
			paint();
		}
	}

	function onFormat(opts: { bold?: boolean; numFmt?: NumFmt; fill?: string }) {
		formatSel(book, opts);
		paint();
	}

	function resetBook() {
		book = createSeedBook();
		evaluateBook(book);
		draft = book.sheets[0]!.cells.C6?.raw ?? '';
		confirmReset = false;
		save();
	}

	function isActive(r: number, c: number) {
		const s = book.selection;
		if (s.sheet !== book.active) return false;
		const r0 = Math.min(s.r0, s.r1);
		const r1 = Math.max(s.r0, s.r1);
		const c0 = Math.min(s.c0, s.c1);
		const c1 = Math.max(s.c0, s.c1);
		return r >= r0 && r <= r1 && c >= c0 && c <= c1;
	}

	function onGridKey(event: KeyboardEvent) {
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
			if (event.key === 'Enter') {
				event.preventDefault();
				commit();
				select(Math.min(sheet.rows - 1, book.selection.r0 + 1), book.selection.c0);
			}
			if (event.key === 'Escape') {
				draft = activeRaw;
				editing = false;
			}
			if (event.key === 'Tab') {
				event.preventDefault();
				commit();
				select(book.selection.r0, Math.min(sheet.cols - 1, book.selection.c0 + 1));
			}
			return;
		}
		const mod = event.metaKey || event.ctrlKey;
		if (mod && event.key.toLowerCase() === 'z') {
			event.preventDefault();
			if (event.shiftKey) onRedo();
			else onUndo();
			return;
		}
		if (mod && event.key.toLowerCase() === 'y') {
			event.preventDefault();
			onRedo();
			return;
		}
		if (mod && event.key.toLowerCase() === 'c') {
			event.preventDefault();
			onCopy();
			return;
		}
		if (mod && event.key.toLowerCase() === 'v') {
			event.preventDefault();
			void onPaste();
			return;
		}
		if (mod && event.key.toLowerCase() === 'b') {
			event.preventDefault();
			onFormat({ bold: true });
			return;
		}
		if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
			event.preventDefault();
			const dr = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
			const dc = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
			const r = Math.max(0, Math.min(sheet.rows - 1, book.selection.r0 + dr));
			const c = Math.max(0, Math.min(sheet.cols - 1, book.selection.c0 + dc));
			select(r, c, event.shiftKey);
			return;
		}
		if (event.key === 'Tab') {
			event.preventDefault();
			select(book.selection.r0, Math.min(sheet.cols - 1, book.selection.c0 + 1));
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			select(Math.min(sheet.rows - 1, book.selection.r0 + 1), book.selection.c0);
			return;
		}
		if (event.key === 'F2') {
			event.preventDefault();
			editing = true;
			draft = activeRaw;
			formulaEl?.focus();
			return;
		}
		if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			commit('');
			return;
		}
		if (event.key.length === 1 && !mod) {
			editing = true;
			draft = event.key;
			formulaEl?.focus();
		}
	}

	onMount(() => {
		book = readReportSave();
		evaluateBook(book);
		draft = getSheet(book, book.active)?.cells[a1(book.selection.r0, book.selection.c0)]?.raw ?? '';
		wrapEl?.focus();
		const syncTheme = () => {
			darkSheet = document.documentElement.classList.contains('dark');
		};
		syncTheme();
		const themeWatch = new MutationObserver(syncTheme);
		themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		const interval = setInterval(save, 4000);
		const stopDrag = () => (dragging = false);
		window.addEventListener('pointerup', stopDrag);
		window.addEventListener('pointercancel', stopDrag);
		return () => {
			clearInterval(interval);
			themeWatch.disconnect();
			window.removeEventListener('pointerup', stopDrag);
			window.removeEventListener('pointercancel', stopDrag);
			save();
		};
	});
</script>

<svelte:head>
	<title>轻心 · {title}</title>
</svelte:head>

<div class="report-play" style={sheetCss} data-sheet-theme={darkSheet ? 'dark' : 'light'}>
	<header class="top qx-glass" data-hud="top">
		<a href="/modules/games" class="{LINK_CLASS} hud-back" data-hud="back">← 返回目录</a>
		<p class="mark" data-hud="mark">{DISCLAIMER}</p>
		<div class="top-actions" data-hud="actions">
			<Button variant="secondary" class="hud-btn" onclick={onUndo} disabled={!book.undo.length}
				>撤销</Button
			>
			<Button variant="secondary" class="hud-btn" onclick={onRedo} disabled={!book.redo.length}
				>重做</Button
			>
			<Button
				variant="secondary"
				class="hud-btn"
				aria-label="恢复示例表"
				onclick={() => (confirmReset = true)}
			>
				<span class="wide">恢复示例表</span>
				<span class="narrow">恢复</span>
			</Button>
		</div>
	</header>

	<div class="bar qx-glass">
		<label class="addr" for="formula-bar">{book.active}!{activeAddr}</label>
		<input
			bind:this={formulaEl}
			id="formula-bar"
			class="formula"
			aria-label="公式栏"
			placeholder="输入数字或 =公式"
			bind:value={draft}
			onfocus={() => (editing = true)}
			onkeydown={(event) => onGridKey(event)}
		/>
		<Button class="hud-btn" onclick={() => commit()}>写入</Button>
	</div>

	<div class="tabs" role="tablist" aria-label="工作表">
		{#each book.sheets as item (item.id)}
			<button
				type="button"
				role="tab"
				class:active={book.active === item.name}
				aria-selected={book.active === item.name}
				onclick={() => switchSheet(item.name)}
			>
				{item.name}
			</button>
		{/each}
	</div>

	<div class="grid-shell">
		<div bind:this={headEl} class="grid-head" aria-hidden="true" onscroll={syncBodyFromHead}>
			<table class="grid" style:width={gridWidth}>
				<colgroup>
					<col class="gutter-col" />
					{#each Array.from({ length: sheet.cols }, (_, c) => c) as c (c)}
						<col class={c === 0 ? 'label-col' : 'data-col'} />
					{/each}
				</colgroup>
				<thead>
					<tr>
						<th class="gutter"></th>
						{#each Array.from({ length: sheet.cols }, (_, c) => c) as c (c)}
							<th>{indexToCol(c)}</th>
						{/each}
					</tr>
				</thead>
			</table>
		</div>
		<div
			bind:this={wrapEl}
			class="grid-wrap"
			data-play="report"
			data-sheet={book.active}
			data-addr={activeAddr}
			data-raw={activeRaw}
			data-ni={String(Math.round(ni * 100) / 100)}
			data-tie={String(Math.round(tie * 1000) / 1000)}
			data-cash={String(Math.round(cash * 100) / 100)}
			data-assets={String(Math.round(assets * 100) / 100)}
			data-growth={String(growth)}
			data-active-kind={cellKind(book, book.active, activeAddr)}
			tabindex="0"
			role="grid"
			aria-label={`${COMPANY}工作簿`}
			aria-activedescendant={`cell-${activeAddr}`}
			onkeydown={onGridKey}
			onscroll={syncHeadFromBody}
		>
			<table class="grid" style:width={gridWidth}>
				<colgroup>
					<col class="gutter-col" />
					{#each Array.from({ length: sheet.cols }, (_, c) => c) as c (`body-${c}`)}
						<col class={c === 0 ? 'label-col' : 'data-col'} />
					{/each}
				</colgroup>
				<tbody>
					{#each Array.from({ length: sheet.rows }, (_, r) => r) as r (r)}
						<tr>
							<th class="gutter">{r + 1}</th>
							{#each Array.from({ length: sheet.cols }, (_, c) => c) as c (`${r}:${c}`)}
								{@const addr = a1(r, c)}
								{@const shown = displayCell(book, book.active, addr)}
								{@const kind = cellKind(book, book.active, addr)}
								{@const cell = sheet.cells[addr]}
								{@const tone = fillTone(cell?.fill)}
								<td
									id={`cell-${addr}`}
									role="gridcell"
									aria-selected={isActive(r, c)}
									data-cell={addr}
									data-kind={kind}
									class:active={isActive(r, c)}
									class:input={kind === 'input'}
									class:formula={kind === 'formula'}
									class:error={kind === 'error'}
									class:bold={cell?.bold}
									class:neg={shown.startsWith('-')}
									class:hl={tone === 'hl'}
									class:warn={tone === 'warn'}
									onpointerdown={(event) => {
										if (event.button !== 0) return;
										dragging = true;
										select(r, c, event.shiftKey);
									}}
									onpointerenter={() => {
										if (dragging) select(r, c, true);
									}}
									ondblclick={() => {
										editing = true;
										draft = activeRaw;
										formulaEl?.focus();
									}}
								>
									{shown}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<p class="status" aria-live="polite">{book.notice}</p>

	<section class="dock qx-glass" aria-label="年报操作">
		<p class="need">
			{COMPANY}。键盘方向键移动，输入后点写入或回车。Ctrl+Z 撤销，Ctrl+C / V 复制粘贴。390
			先点格子再改公式栏。
		</p>
		<div class="actions">
			<Button variant="secondary" class="min-h-12 px-5" onclick={onInsertRow}>插入行</Button>
			<Button
				variant="secondary"
				class="min-h-12 px-5"
				onclick={() => onFormat({ numFmt: 'percent' })}>%</Button
			>
			<Button
				variant="secondary"
				class="min-h-12 px-5"
				onclick={() => onFormat({ numFmt: 'decimal2' })}
			>
				两位小数
			</Button>
			<Button variant="secondary" class="min-h-12 px-5" onclick={() => onFormat({ bold: true })}
				>加粗</Button
			>
			<Button variant="secondary" class="min-h-12 px-5" onclick={onCopy}>复制</Button>
			<Button variant="secondary" class="min-h-12 px-5" onclick={() => void onPaste()}>粘贴</Button>
		</div>
	</section>
</div>

{#if confirmReset}
	<div class="mask">
		<div class="dialog qx-glass" role="dialog" aria-labelledby="reset-title">
			<h2 id="reset-title">恢复示例表？</h2>
			<p>只丢掉这本游戏年报里的改动。主题和其它游戏存档不动。</p>
			<div class="actions">
				<Button variant="secondary" onclick={() => (confirmReset = false)}>取消</Button>
				<Button onclick={resetBook}>确认恢复</Button>
			</div>
		</div>
	</div>
{/if}

<style>
	.report-play {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		min-height: 0;
		overflow: hidden;
		background:
			radial-gradient(
				1200px 420px at 10% -10%,
				color-mix(in srgb, var(--qx-accent-gold) 18%, transparent),
				transparent
			),
			color-mix(in srgb, #f4ead8 55%, var(--qx-bg));
	}

	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem 0.55rem;
		margin: 0.4rem 0.65rem 0;
		padding: 0.4rem 0.65rem;
		padding-top: max(0.4rem, env(safe-area-inset-top));
		border-radius: 1.15rem;
		flex-shrink: 0;
	}

	.mark {
		flex: 1 1 12rem;
		margin: 0;
		min-width: 0;
		font-size: 0.78rem;
		line-height: 1.35;
		color: var(--qx-muted);
	}

	.hud-back {
		white-space: nowrap;
		min-width: 0;
	}

	.top-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-left: auto;
		min-width: 0;
	}

	.narrow {
		display: none;
	}

	.bar {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin: 0.35rem 0.65rem 0;
		padding: 0.35rem 0.55rem;
		border-radius: 0.95rem;
		flex-shrink: 0;
	}

	.addr {
		flex: 0 0 auto;
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		color: var(--qx-primary);
		min-width: 6.5rem;
	}

	.formula {
		flex: 1 1 auto;
		min-width: 0;
		min-height: 44px;
		appearance: none;
		border: 1px solid var(--sheet-line);
		border-radius: 2px;
		padding: 0.3rem 0.6rem;
		background: var(--sheet-bar-bg);
		color: var(--sheet-ink);
		caret-color: var(--sheet-ink);
		-webkit-text-fill-color: var(--sheet-ink);
		font: inherit;
		font-variant-numeric: tabular-nums;
		color-scheme: light;
	}

	.report-play[data-sheet-theme='dark'] .formula {
		color-scheme: dark;
	}

	.formula::placeholder {
		color: var(--sheet-muted);
		-webkit-text-fill-color: var(--sheet-muted);
		opacity: 1;
	}

	.formula::selection {
		background: var(--sheet-select);
		color: var(--sheet-ink);
		-webkit-text-fill-color: var(--sheet-ink);
	}

	.tabs {
		display: flex;
		gap: 0.3rem;
		margin: 0.35rem 0.65rem 0;
		overflow-x: auto;
		flex-shrink: 0;
	}

	.tabs button {
		min-height: 44px;
		min-width: 44px;
		padding: 0 0.9rem;
		border: 0;
		border-radius: 0.85rem 0.85rem 0 0;
		background: color-mix(in srgb, var(--qx-card) 70%, transparent);
		color: var(--qx-text);
		font-weight: 700;
		white-space: nowrap;
	}

	.tabs button.active {
		background: color-mix(in srgb, var(--qx-primary) 18%, var(--qx-card));
		color: var(--qx-primary);
	}

	.grid-shell {
		flex: 1;
		min-height: 0;
		min-width: 0;
		margin: 0 0.65rem;
		display: flex;
		flex-direction: column;
		border-radius: 0;
		border: 1px solid var(--sheet-line);
		background: var(--sheet-paper);
		box-shadow: none;
		color: var(--sheet-ink);
		-webkit-text-fill-color: var(--sheet-ink);
		color-scheme: light;
	}

	.report-play[data-sheet-theme='dark'] .grid-shell {
		color-scheme: dark;
	}

	.grid-shell ::selection {
		background: var(--sheet-select);
		color: var(--sheet-ink);
		-webkit-text-fill-color: var(--sheet-ink);
	}

	.grid-head {
		flex-shrink: 0;
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: none;
	}

	.grid-head::-webkit-scrollbar {
		height: 0;
		display: none;
	}

	.grid-wrap {
		flex: 1;
		min-height: 0;
		min-width: 0;
		overflow: auto;
		-webkit-overflow-scrolling: touch;
		touch-action: pan-x pan-y;
		outline: none;
	}

	.grid {
		border-collapse: separate;
		border-spacing: 0;
		table-layout: fixed;
		font-variant-numeric: tabular-nums;
	}

	.gutter-col,
	.gutter {
		width: 2.1rem;
		min-width: 2.1rem;
		max-width: 2.1rem;
	}

	.label-col,
	.grid th:nth-child(2),
	.grid td:nth-child(2) {
		width: 9.5rem;
		min-width: 9.5rem;
		max-width: 9.5rem;
	}

	.data-col,
	.grid th:nth-child(n + 3),
	.grid td:nth-child(n + 3) {
		width: 5.4rem;
		min-width: 5.4rem;
		max-width: 5.4rem;
	}

	.grid th,
	.grid td {
		border: 0;
		border-bottom: 1px solid var(--sheet-line);
		border-right: 1px solid var(--sheet-line);
		border-radius: 0;
		box-shadow: none;
		backdrop-filter: none;
		padding: 0.22rem 0.4rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 0.8125rem;
		line-height: 1.25;
		user-select: none;
		color: var(--sheet-ink);
		-webkit-text-fill-color: var(--sheet-ink);
		background: var(--sheet-paper);
	}

	.grid tbody tr:nth-child(even) td {
		background: var(--sheet-paper-alt);
	}

	.grid thead th,
	.grid-head th {
		background: var(--sheet-header);
		color: var(--sheet-ink);
		-webkit-text-fill-color: var(--sheet-ink);
		font-size: 0.72rem;
		font-weight: 700;
		text-align: center;
	}

	.grid-head th:nth-child(2) {
		position: sticky;
		left: 2.1rem;
		z-index: 3;
		background: var(--sheet-header);
		text-align: center;
	}

	.gutter {
		position: sticky;
		left: 0;
		z-index: 3;
		background: var(--sheet-gutter);
		text-align: center;
		color: var(--sheet-gutter-ink);
		-webkit-text-fill-color: var(--sheet-gutter-ink);
	}

	.grid thead .gutter {
		z-index: 4;
		background: var(--sheet-header);
		color: var(--sheet-ink);
		-webkit-text-fill-color: var(--sheet-ink);
	}

	.grid td:nth-child(2),
	.grid tbody th + td {
		position: sticky;
		left: 2.1rem;
		z-index: 1;
		background: var(--sheet-gutter);
		font-weight: 650;
		text-align: left;
		color: var(--sheet-ink);
		-webkit-text-fill-color: var(--sheet-ink);
	}

	.grid tbody tr:nth-child(even) td:nth-child(2) {
		background: var(--sheet-gutter);
	}

	.grid td:nth-child(n + 3),
	.grid th:nth-child(n + 3) {
		text-align: right;
		font-variant-numeric: tabular-nums lining-nums;
	}

	.grid td.input {
		font-weight: 700;
		background: var(--sheet-input-bg);
		color: var(--sheet-ink);
		-webkit-text-fill-color: var(--sheet-ink);
	}

	.grid td.formula {
		font-weight: 500;
		background: var(--sheet-formula-bg);
		color: var(--sheet-formula-ink);
		-webkit-text-fill-color: var(--sheet-formula-ink);
	}

	.grid tbody tr:nth-child(even) td.input {
		background: var(--sheet-input-bg);
	}

	.grid tbody tr:nth-child(even) td.formula {
		background: var(--sheet-formula-bg);
	}

	.grid td.error {
		color: var(--sheet-error);
		-webkit-text-fill-color: var(--sheet-error);
		background: var(--sheet-error-bg);
		font-weight: 700;
	}

	.grid td.neg {
		color: var(--sheet-error);
		-webkit-text-fill-color: var(--sheet-error);
	}

	.grid td.hl {
		background: var(--sheet-hl);
		color: var(--sheet-ink);
		-webkit-text-fill-color: var(--sheet-ink);
	}

	.grid td.warn {
		background: var(--sheet-warn);
		color: var(--sheet-ink);
		-webkit-text-fill-color: var(--sheet-ink);
	}

	.grid td.bold {
		font-weight: 800;
	}

	.grid td.active {
		outline: 2px solid var(--sheet-select-line);
		outline-offset: -2px;
		background: var(--sheet-select);
		color: var(--sheet-ink);
		-webkit-text-fill-color: var(--sheet-ink);
		z-index: 2;
		border-radius: 0;
	}

	.status {
		margin: 0.25rem 0.85rem 0;
		font-size: 0.8rem;
		color: var(--qx-muted);
		flex-shrink: 0;
	}

	.dock {
		flex-shrink: 0;
		margin: 0.3rem 0.65rem max(0.4rem, env(safe-area-inset-bottom));
		padding: 0.55rem 0.7rem;
		border-radius: 1.2rem;
	}

	.need {
		margin: 0;
		font-size: 0.88rem;
		font-weight: 650;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.4rem;
	}

	.mask {
		position: fixed;
		inset: 0;
		background: rgb(15 23 42 / 0.45);
		display: grid;
		place-items: center;
		z-index: 20;
		padding: 1rem;
	}

	.dialog {
		max-width: 26rem;
		padding: 1.1rem 1.2rem;
		border-radius: 1.2rem;
	}

	.dialog h2 {
		margin: 0;
		font-size: 1.15rem;
	}

	.dialog p {
		margin: 0.45rem 0 0;
		color: var(--qx-muted);
	}

	@media (max-width: 720px) {
		.top {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			row-gap: 0.28rem;
		}

		.hud-back {
			grid-column: 1;
			grid-row: 1;
		}

		.top-actions {
			grid-column: 2;
			grid-row: 1;
			margin-left: 0;
			flex-wrap: nowrap;
		}

		.wide {
			display: none;
		}

		.narrow {
			display: inline;
		}

		.bar {
			flex-wrap: wrap;
		}

		.mark {
			grid-column: 1 / -1;
			grid-row: 2;
		}

		.top :global(.hud-btn) {
			min-width: 0;
			min-height: 2.5rem;
			padding-inline: 0.55rem;
			font-size: 0.85rem;
		}

		.grid-shell {
			min-width: 0;
		}

		.need {
			font-size: 0.8rem;
		}
	}
</style>

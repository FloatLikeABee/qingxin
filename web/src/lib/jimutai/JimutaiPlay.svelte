<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import { TAP_PX, classifyGesture, originFromPieceFace } from './input';
	import { GRID_X, GRID_Y, GRID_Z, SHAPES, type Cell } from './pieces';
	import { readJimutaiSave, writeJimutaiSave } from './persist';
	import type { JimutaiScene } from './render';
	import {
		canPlace,
		createWorld,
		occupancy,
		placeAt,
		previewCells,
		resetWorld,
		rotateSelected,
		selectTray,
		undoLast,
		type World
	} from './world';

	const COLOR_NAME = {
		blue: '蓝',
		sky: '晴',
		coral: '珊瑚',
		teal: '青',
		gold: '金'
	} as const;

	const COLOR_HEX = {
		blue: '#3B82F6',
		sky: '#60A5FA',
		coral: '#FB7185',
		teal: '#2DD4BF',
		gold: '#FBBF24'
	} as const;

	let world = $state<World>(createWorld());
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let stageEl = $state<HTMLDivElement | null>(null);
	let sceneFailed = $state(false);
	let ghostOrigin = $state<Cell | null>(null);
	let confirmReset = $state(false);

	function currentGhost() {
		if (!ghostOrigin) return null;
		const check = canPlace(world, ghostOrigin);
		return {
			cells: check.cells.length ? check.cells : previewCells(world, ghostOrigin),
			ok: check.ok
		};
	}

	function save() {
		writeJimutaiSave(world);
	}

	function paint() {
		const root = stageEl?.parentElement;
		if (!(root instanceof HTMLElement)) return;
		root.dataset.jimutai = '1';
		root.dataset.placed = String(world.placed.length);
		root.dataset.tray = String(world.tray.length);
		root.dataset.batch = String(world.batchIndex);
		root.dataset.selected = String(world.selected);
		root.dataset.ghost = ghostOrigin ? `${ghostOrigin.x},${ghostOrigin.y},${ghostOrigin.z}` : '';
		root.dataset.ghostOk = currentGhost()?.ok ? '1' : '0';
		root.dataset.ready = sceneFailed ? '0' : '1';
	}

	function tryPlace() {
		if (!ghostOrigin) return;
		if (placeAt(world, ghostOrigin)) save();
		paint();
	}

	function rotate(axis: 'y' | 'x') {
		rotateSelected(world, axis);
		save();
		paint();
	}

	function undo() {
		if (undoLast(world)) save();
		paint();
	}

	function askReset() {
		confirmReset = true;
	}

	function cancelReset() {
		confirmReset = false;
	}

	function confirmClear() {
		resetWorld(world);
		confirmReset = false;
		ghostOrigin = { x: 7, y: 0, z: 7 };
		save();
		paint();
	}

	function stackTop(x: number, z: number) {
		const occ = occupancy(world);
		let y = 0;
		while (y < GRID_Y && occ.has(`${x},${y},${z}`)) y += 1;
		return y;
	}

	function placeFallback(x: number, z: number) {
		const y = stackTop(x, z);
		ghostOrigin = { x, y, z };
		tryPlace();
	}

	onMount(() => {
		world = readJimutaiSave();
		paint();
		let scene: JimutaiScene | null = null;
		let raf = 0;
		const canvas = canvasEl;
		const stage = stageEl;
		if (!canvas || !stage) return;
		let cancelled = false;
		let resizeObserver: ResizeObserver | undefined;
		const pointers = new Map<number, { x: number; y: number }>();
		let startX = 0;
		let startY = 0;
		let lastX = 0;
		let lastY = 0;
		let button = 0;
		let shifted = false;
		let moved = false;
		let pinch = 0;

		const onKey = (event: KeyboardEvent) => {
			if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
				return;
			if (event.key >= '1' && event.key <= '5') {
				selectTray(world, Number(event.key) - 1);
				paint();
			}
			if (event.key === 'r' || event.key === 'R') rotate('y');
			if (event.key === 't' || event.key === 'T') rotate('x');
			if (event.key === 'z' || event.key === 'Z') {
				event.preventDefault();
				undo();
			}
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				tryPlace();
			}
			if (event.key === 'Escape') confirmReset = false;
			if (event.key === '=' || event.key === '+') scene?.zoom(-1);
			if (event.key === '-' || event.key === '_') scene?.zoom(1);
			if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') scene?.orbit(-18, 0);
			if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') scene?.orbit(18, 0);
			if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') scene?.orbit(0, -14);
			if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') scene?.orbit(0, 14);
			if (scene) {
				world.camera = scene.readCamera();
			}
		};
		window.addEventListener('keydown', onKey);

		const drop: Array<() => void> = [];
		void (async () => {
			const { mountJimutaiScene } = await import('./render');
			if (cancelled) return;
			try {
				scene = mountJimutaiScene(canvas);
			} catch {
				scene = null;
			}
			if (!scene) {
				sceneFailed = true;
				canvas.dataset.ready = '0';
			} else {
				scene.applyCamera(world.camera);
				scene.resize();
				canvas.dataset.ready = '1';
				const onResize = () => scene?.resize();
				resizeObserver = new ResizeObserver(onResize);
				resizeObserver.observe(stage);
				window.addEventListener('resize', onResize);

				const setGhost = (clientX: number, clientY: number) => {
					const hit = scene?.pick(clientX, clientY);
					if (!hit) {
						ghostOrigin = null;
						return;
					}
					ghostOrigin = hit.kind === 'ground' ? hit.cell : originFromPieceFace(hit.cell, hit.face);
				};

				const onDown = (event: PointerEvent) => {
					pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
					if (pointers.size === 1) {
						startX = event.clientX;
						startY = event.clientY;
						lastX = event.clientX;
						lastY = event.clientY;
						button = event.button;
						shifted = event.shiftKey;
						moved = false;
						stage.setPointerCapture(event.pointerId);
					}
					if (pointers.size === 2) {
						const pts = [...pointers.values()];
						pinch = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
						moved = true;
					}
				};
				const onMove = (event: PointerEvent) => {
					if (pointers.has(event.pointerId)) {
						pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
					}
					if (pointers.size >= 2) {
						const pts = [...pointers.values()];
						const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
						const midX = (pts[0]!.x + pts[1]!.x) / 2;
						const midY = (pts[0]!.y + pts[1]!.y) / 2;
						if (pinch) scene?.zoom(dist > pinch ? -1 : 1);
						scene?.pan(event.clientX - lastX, event.clientY - lastY);
						pinch = dist;
						lastX = midX;
						lastY = midY;
						moved = true;
						if (scene) world.camera = scene.readCamera();
						return;
					}
					if (!pointers.size) {
						setGhost(event.clientX, event.clientY);
						paint();
						return;
					}
					const dx = event.clientX - startX;
					const dy = event.clientY - startY;
					const kind = classifyGesture({
						dx,
						dy,
						pointers: 1,
						shift: shifted,
						button
					});
					if (Math.hypot(dx, dy) >= TAP_PX) moved = true;
					if (kind === 'orbit') scene?.orbit(event.clientX - lastX, event.clientY - lastY);
					if (kind === 'pan') scene?.pan(event.clientX - lastX, event.clientY - lastY);
					lastX = event.clientX;
					lastY = event.clientY;
					if (scene) world.camera = scene.readCamera();
				};
				const onUp = (event: PointerEvent) => {
					pointers.delete(event.pointerId);
					if (pointers.size === 0) {
						if (!moved) {
							setGhost(event.clientX, event.clientY);
							tryPlace();
						} else {
							save();
						}
						moved = false;
						pinch = 0;
					}
				};
				const onWheel = (event: WheelEvent) => {
					event.preventDefault();
					scene?.zoom(event.deltaY);
					if (scene) world.camera = scene.readCamera();
				};
				stage.addEventListener('pointerdown', onDown);
				stage.addEventListener('pointermove', onMove);
				stage.addEventListener('pointerup', onUp);
				stage.addEventListener('pointercancel', onUp);
				stage.addEventListener('wheel', onWheel, { passive: false });
				drop.push(() => {
					window.removeEventListener('resize', onResize);
					stage.removeEventListener('pointerdown', onDown);
					stage.removeEventListener('pointermove', onMove);
					stage.removeEventListener('pointerup', onUp);
					stage.removeEventListener('pointercancel', onUp);
					stage.removeEventListener('wheel', onWheel);
				});
			}

			const loop = () => {
				paint();
				scene?.sync(world, currentGhost());
				scene?.render(performance.now());
				raf = requestAnimationFrame(loop);
			};
			raf = requestAnimationFrame(loop);
			if (cancelled) {
				cancelAnimationFrame(raf);
				scene?.dispose();
			}
		})();

		const interval = setInterval(save, 4000);
		if (
			typeof window !== 'undefined' &&
			(window as Window & { __qingxinE2E?: boolean }).__qingxinE2E
		) {
			(
				window as Window & {
					__qingxinJimutai?: {
						getState: () => {
							placed: number;
							tray: number;
							batchIndex: number;
							selected: number;
							notice: string;
						};
						placeAt: (x: number, y: number, z: number) => boolean;
						screenOf: (cell: Cell) => { x: number; y: number } | null;
					};
				}
			).__qingxinJimutai = {
				getState: () => ({
					placed: world.placed.length,
					tray: world.tray.length,
					batchIndex: world.batchIndex,
					selected: world.selected,
					notice: world.notice
				}),
				placeAt: (x, y, z) => {
					const ok = placeAt(world, { x, y, z });
					if (ok) save();
					paint();
					return ok;
				},
				screenOf: (cell) => scene?.screenOf(cell) ?? null
			};
		}

		return () => {
			cancelled = true;
			cancelAnimationFrame(raf);
			clearInterval(interval);
			resizeObserver?.disconnect();
			for (const fn of drop) fn();
			window.removeEventListener('keydown', onKey);
			scene?.dispose();
		};
	});
</script>

<svelte:head>
	<title>轻心 · 积木台</title>
</svelte:head>

<div
	class="play"
	data-jimutai="1"
	data-placed={world.placed.length}
	data-tray={world.tray.length}
	data-batch={world.batchIndex}
	data-selected={world.selected}
	data-ghost-ok={currentGhost()?.ok ? '1' : '0'}
>
	<header class="top qx-glass">
		<a href="/modules" class="{LINK_CLASS} shrink-0">← 返回模块</a>
		<h1>积木台</h1>
		<ul class="stats" aria-label="积木">
			<li><b>{world.tray.length}</b><span>托盘</span></li>
			<li><b>{world.placed.length}</b><span>已搭</span></li>
			<li><b>{world.batchIndex}</b><span>补货</span></li>
		</ul>
	</header>

	<div bind:this={stageEl} class="stage" data-play="jimutai">
		<canvas bind:this={canvasEl} class="h-full w-full" aria-label="积木台"></canvas>
		{#if sceneFailed}
			<p class="fail">这台设备画不出三维桌子。用下面的格子继续搭。</p>
		{/if}
	</div>

	<section class="dock qx-glass" aria-label="积木托盘" data-jimutai-dock>
		<p class="notice" aria-live="polite">{world.notice}</p>
		<p class="meta">16×16×12 格，最多 80 块。没有输赢。点桌子放积木，拖动画看，两指缩放。</p>
		<p class="sr-only">
			数字 1 到 5 选托盘。R 旋转，T 倾斜，回车放下，Z 撤销，方向键环视，加减缩放。
		</p>
		<div class="tray" role="listbox" aria-label="托盘里的积木">
			{#each world.tray as piece, index (piece.id)}
				<button
					type="button"
					class="slot {world.selected === index ? 'on' : ''}"
					role="option"
					aria-selected={world.selected === index}
					onclick={() => selectTray(world, index)}
				>
					<span class="swatch" style="background:{COLOR_HEX[piece.color]}"></span>
					<b>{SHAPES[piece.shape].name}</b>
					<span>{COLOR_NAME[piece.color]}</span>
				</button>
			{/each}
			{#each Array.from( { length: Math.max(0, 5 - world.tray.length) } ) as _, index (`empty-${index}`)}
				<div class="slot empty" aria-hidden="true"></div>
			{/each}
		</div>
		<div class="row">
			<Button onclick={() => rotate('y')}>旋转</Button>
			<Button variant="secondary" onclick={() => rotate('x')}>倾斜</Button>
			<Button variant="secondary" onclick={undo} disabled={world.undo.length === 0}>撤销</Button>
			<Button variant="ghost" onclick={askReset}>清空积木台</Button>
		</div>
	</section>

	{#if sceneFailed}
		<div class="fallback" aria-label="俯视格子">
			{#each Array.from({ length: GRID_Z }) as _, z (`z-${z}`)}
				{#each Array.from({ length: GRID_X }) as _, x (`x-${x}-${z}`)}
					<button
						type="button"
						class="cell"
						style:grid-column={x + 1}
						style:grid-row={z + 1}
						onclick={() => placeFallback(x, z)}
						aria-label={`${x},${z} 放下`}
					>
						{stackTop(x, z) || ''}
					</button>
				{/each}
			{/each}
		</div>
	{/if}

	{#if confirmReset}
		<div class="overlay" role="dialog" aria-modal="true" aria-label="清空积木台">
			<article class="sheet qx-glass">
				<h2 class="font-[Outfit] text-2xl font-semibold">清空积木台？</h2>
				<p class="mt-2 text-sm text-[var(--qx-muted)]">
					搭好的积木会从桌子上拿掉，托盘重新发五块。取消则原样留下。
				</p>
				<div class="mt-5 flex flex-wrap gap-2">
					<Button variant="secondary" onclick={cancelReset}>取消</Button>
					<Button variant="danger" onclick={confirmClear}>清空积木台</Button>
				</div>
			</article>
		</div>
	{/if}
</div>

<style>
	.play {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100dvh;
		min-height: 0;
		overflow: hidden;
		background: var(--qx-bg);
	}

	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem 0.6rem;
		margin: 0.4rem 0.65rem 0;
		padding: 0.4rem 0.65rem;
		padding-top: max(0.4rem, env(safe-area-inset-top));
		border-radius: 1.15rem;
		z-index: 10;
	}

	h1 {
		margin: 0;
		font-family: Outfit, var(--font-sans);
		font-size: 1.15rem;
		font-weight: 600;
	}

	.stats {
		display: flex;
		flex: 1;
		justify-content: flex-end;
		gap: 0.9rem;
		margin: 0;
		padding: 0;
		list-style: none;
		font-family: Outfit, var(--font-sans);
		font-variant-numeric: tabular-nums;
	}

	.stats li {
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1.15;
	}

	.stats span {
		font-family: var(--font-sans);
		font-size: 0.62rem;
		color: var(--qx-muted);
	}

	.stage {
		position: relative;
		flex: 1;
		min-height: 0;
		touch-action: none;
	}

	.fail {
		position: absolute;
		inset: auto 0.8rem 0.8rem;
		text-align: center;
		color: var(--qx-muted);
	}

	.dock {
		flex-shrink: 0;
		margin: 0.35rem 0.65rem max(0.45rem, env(safe-area-inset-bottom));
		padding: 0.65rem 0.8rem 0.7rem;
		border-radius: 1.35rem;
		z-index: 10;
		max-height: 38dvh;
		overflow: auto;
		overscroll-behavior: contain;
	}

	.notice {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.meta {
		margin: 0.2rem 0 0.45rem;
		font-size: 0.82rem;
		color: var(--qx-muted);
	}

	.tray {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.35rem;
	}

	.slot {
		display: flex;
		min-height: 44px;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.05rem;
		border-radius: 0.9rem;
		border: 1px solid var(--qx-line);
		background: var(--qx-surface);
		color: var(--qx-text);
		font-size: 0.72rem;
		line-height: 1.1;
	}

	.slot b {
		font-size: 0.78rem;
	}

	.slot.on {
		border-color: var(--qx-primary);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--qx-primary) 45%, transparent);
	}

	.slot.empty {
		border-style: dashed;
		background: transparent;
		min-height: 44px;
	}

	.swatch {
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 0.2rem;
		box-shadow: 0 1px 2px rgb(15 23 42 / 0.25);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 0.5rem;
	}

	.overlay {
		position: absolute;
		inset: 0;
		z-index: 20;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: color-mix(in oklab, var(--qx-bg) 55%, transparent);
	}

	.sheet {
		width: min(26rem, 100%);
		padding: 1.1rem 1.2rem 1.2rem;
		border-radius: 1.35rem;
	}

	.fallback {
		display: grid;
		grid-template-columns: repeat(16, minmax(18px, 1fr));
		gap: 1px;
		margin: 0 0.65rem 0.5rem;
		max-height: 28dvh;
		overflow: auto;
	}

	.cell {
		min-height: 22px;
		min-width: 18px;
		border-radius: 4px;
		background: color-mix(in oklab, var(--qx-primary) 16%, var(--qx-card));
		font-size: 0.6rem;
		color: var(--qx-text);
	}

	@media (prefers-reduced-motion: reduce) {
		.slot {
			transition: none;
		}
	}
</style>

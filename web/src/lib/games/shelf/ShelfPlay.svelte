<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import { popShelf, setShelfMuted, stopShelfAudio, unlockShelfAudio, whimperShelf } from './audio';
	import { readShelfSave, writeShelfSave } from './persist';
	import type { ShelfScene } from './render';
	import {
		anyApology,
		applyTable,
		findItem,
		hauntOf,
		hauntIdsOf,
		hauntProgress,
		isCompact,
		isHaunting,
		nextRound,
		pickItem,
		placeHeld,
		restartShelf,
		shelfLayout,
		shelfPhase,
		stepShelf,
		tableOf,
		visibleItems,
		type HauntPhase,
		type ShelfWorld
	} from './sim';

	const PHASE_LABEL: Record<HauntPhase, string> = {
		idle: '闲逛',
		emerge: '钻出来',
		face: '露脸',
		cry: '大哭',
		sorry: '道歉',
		retreat: '钻回去',
		done: '安静了'
	};

	const DRAG_PX = 12;

	let { title }: { title: string } = $props();

	let world = $state<ShelfWorld>(readShelfSave());
	let sceneFailed = $state(false);
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let stageEl = $state<HTMLDivElement | null>(null);
	let audioOn = $state(false);
	let bubbles = $state<Array<{ x: number; y: number; id: string }>>([]);
	let fpsLabel = $state('—');
	let lastHauntSig = '';

	function save() {
		writeShelfSave(world);
	}

	function heldTitle() {
		if (!world.heldId) return '空手';
		return findItem(world, world.heldId)?.title ?? '空手';
	}

	function paint(canvas: HTMLCanvasElement | null = canvasEl, scene: ShelfScene | null = null) {
		if (!canvas) return;
		const vis = visibleItems(world);
		const ids = hauntIdsOf(world);
		const busy = new Set(ids);
		canvas.dataset.phase = shelfPhase(world);
		canvas.dataset.haunt = ids.join(',');
		canvas.dataset.hcount = String(ids.length);
		canvas.dataset.held = world.heldId ?? '';
		canvas.dataset.layout = shelfLayout(world).join('|');
		canvas.dataset.apology = anyApology(world) ? '1' : '0';
		canvas.dataset.round = String(world.round);
		canvas.dataset.anim = world.paused ? '0' : '1';
		canvas.dataset.detail = world.lowDetail ? 'low' : 'high';
		canvas.dataset.compact = isCompact(world) ? '1' : '0';
		canvas.dataset.audio = audioOn ? '1' : '0';
		canvas.dataset.progress = String(Math.round(hauntProgress(world) * 100) / 100);
		canvas.dataset.playing = isHaunting(world) ? '1' : '0';
		canvas.dataset.items = String(vis.length);
		canvas.dataset.fps = fpsLabel;
		canvas.dataset.notice = world.notice;
		const others = vis.filter((item) => !busy.has(item.id) && item.id !== world.heldId);
		const reachable = others.filter((item) => item.row >= 1 && item.row <= 3);
		const books = reachable.filter((item) => item.kind === 'book');
		const pool = books.length >= 2 ? books : reachable.length >= 2 ? reachable : others;
		const other = pool.reduce((best, item) => {
			if (!best) return item;
			if (item.slot < best.slot || (item.slot === best.slot && item.row <= best.row)) return item;
			return best;
		}, pool[0]);
		const buddy = pool.reduce(
			(best, item) => {
				if (!best) return item;
				if (item.id === other?.id) return best;
				if (item.slot > best.slot || (item.slot === best.slot && item.row >= best.row)) return item;
				return best;
			},
			pool.find((item) => item.id !== other?.id)
		);
		canvas.dataset.aid = other?.id ?? '';
		canvas.dataset.bid = buddy?.id ?? '';
		const nextBubbles: Array<{ x: number; y: number; id: string }> = [];
		if (scene) {
			ids.forEach((id, i) => {
				canvas.dataset[`h${i}`] = id;
				canvas.dataset[`hp${i}`] = world.haunts[i]?.phase ?? '';
				const bookPt = scene.project(id);
				if (bookPt) {
					canvas.dataset[`hx${i}`] = String(Math.round(bookPt.x));
					canvas.dataset[`hy${i}`] = String(Math.round(bookPt.y));
				}
				const ghostPt = scene.projectGhost(i);
				if (ghostPt) {
					canvas.dataset[`gx${i}`] = String(Math.round(ghostPt.x));
					canvas.dataset[`gy${i}`] = String(Math.round(ghostPt.y));
				}
				if (world.haunts[i]?.phase === 'sorry' && ghostPt) {
					nextBubbles.push({
						id,
						x: Math.min(88, Math.max(12, (ghostPt.x / (canvas.clientWidth || 1)) * 100)),
						y: Math.min(62, Math.max(18, (ghostPt.y / (canvas.clientHeight || 1)) * 100))
					});
				}
			});
			const tapId = world.haunts.find((h) => h.phase === 'idle')?.bookId ?? ids[0];
			const hauntPt = tapId ? scene.project(tapId) : null;
			if (hauntPt) {
				canvas.dataset.hx = String(Math.round(hauntPt.x));
				canvas.dataset.hy = String(Math.round(hauntPt.y));
			}
			if (other) {
				const a = scene.project(other.id);
				if (a) {
					canvas.dataset.ax = String(Math.round(a.x));
					canvas.dataset.ay = String(Math.round(a.y));
				}
			}
			if (buddy) {
				const b = scene.project(buddy.id);
				if (b) {
					canvas.dataset.bx = String(Math.round(b.x));
					canvas.dataset.by = String(Math.round(b.y));
				}
			}
			const ghostPt = scene.projectGhost(0) ?? hauntPt;
			if (ghostPt) {
				canvas.dataset.gx = String(Math.round(ghostPt.x));
				canvas.dataset.gy = String(Math.round(ghostPt.y));
			}
		}
		bubbles = nextBubbles;
	}

	function togglePause() {
		world.paused = !world.paused;
		paint();
	}

	function toggleDock() {
		world.dockCollapsed = !world.dockCollapsed;
		save();
	}

	function toggleDetail() {
		world.lowDetail = !world.lowDetail;
		applyTable(world);
		save();
		paint();
	}

	async function toggleAudio() {
		if (!audioOn) {
			const ok = await unlockShelfAudio();
			if (!ok) return;
			audioOn = true;
			world.audioWanted = true;
			setShelfMuted(false);
			save();
			paint();
			return;
		}
		audioOn = false;
		setShelfMuted(true);
		paint();
	}

	function restart() {
		restartShelf(world);
		lastHauntSig = '';
		save();
		paint();
	}

	function goNext() {
		nextRound(world);
		save();
		paint();
	}

	onMount(() => {
		world = readShelfSave();
		lastHauntSig = world.haunts.map((h) => `${h.bookId}:${h.phase}`).join('|');
		let scene: ShelfScene | null = null;
		let raf = 0;
		let last = performance.now();
		let frames = 0;
		let fpsAt = performance.now();
		const canvas = canvasEl;
		const stage = stageEl;
		if (!canvas || !stage) return;
		let resizeObserver: ResizeObserver | undefined;
		let cancelled = false;
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		world.reducedMotion = motion.matches;
		world.narrow = (stage.clientWidth || window.innerWidth) < 500;
		applyTable(world);

		let pointerDown = false;
		let pickedThisDown = false;
		let moved = false;
		let startX = 0;
		let startY = 0;

		const onDown = (event: PointerEvent) => {
			if (event.pointerType === 'mouse' && event.button !== 0) return;
			if (world.paused) return;
			pointerDown = true;
			moved = false;
			pickedThisDown = false;
			startX = event.clientX;
			startY = event.clientY;
			stage.setPointerCapture(event.pointerId);
			const hit = scene?.hit(event.clientX, event.clientY);
			if (!world.heldId && hit?.id) {
				pickItem(world, hit.id);
				pickedThisDown = true;
				save();
			}
			paint(canvas, scene);
		};
		const onMove = (event: PointerEvent) => {
			if (!pointerDown) return;
			if (Math.hypot(event.clientX - startX, event.clientY - startY) > DRAG_PX) moved = true;
		};
		const onUp = (event: PointerEvent) => {
			if (!pointerDown) return;
			pointerDown = false;
			try {
				stage.releasePointerCapture(event.pointerId);
			} catch {
				// already released
			}
			if (world.paused || !world.heldId) {
				paint(canvas, scene);
				return;
			}
			if (pickedThisDown && !moved) {
				paint(canvas, scene);
				return;
			}
			const hit = scene?.hit(event.clientX, event.clientY, world.heldId);
			if (
				hit?.row != null &&
				hit.slot != null &&
				Number.isFinite(hit.row) &&
				Number.isFinite(hit.slot)
			) {
				placeHeld(world, hit.row, hit.slot);
				save();
			}
			paint(canvas, scene);
		};

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
				return;
			if (event.key === 'p' || event.key === 'P') togglePause();
			if (event.key === 'Escape' && world.heldId) {
				const held = findItem(world, world.heldId);
				if (held) placeHeld(world, held.row, held.slot);
				save();
			}
			paint(canvas, scene);
		};

		void (async () => {
			const { mountShelfScene } = await import('./render');
			if (cancelled) return;
			scene = mountShelfScene(canvas);
			if (!scene) sceneFailed = true;
			else scene.resize();
			canvas.dataset.ready = '1';
			scene?.sync(world, { reducedMotion: motion.matches });
			paint(canvas, scene);
			resizeObserver = new ResizeObserver(() => {
				const nextNarrow = (stage.clientWidth || window.innerWidth) < 500;
				if (nextNarrow !== world.narrow) {
					world.narrow = nextNarrow;
					applyTable(world);
				}
				scene?.resize();
			});
			resizeObserver.observe(stage);
			const loop = (now: number) => {
				const dt = Math.min(48, now - last);
				last = now;
				world.reducedMotion = motion.matches;
				if (!world.paused && !document.hidden) {
					stepShelf(world, dt);
					const sig = world.haunts.map((h) => `${h.bookId}:${h.phase}`).join('|');
					if (sig !== lastHauntSig) {
						for (const haunt of world.haunts) {
							const key = `${haunt.bookId}:${haunt.phase}`;
							if (haunt.phase === 'emerge' && !lastHauntSig.includes(key)) popShelf();
							if (haunt.phase === 'cry' && !lastHauntSig.includes(key)) whimperShelf();
						}
						lastHauntSig = sig;
						save();
					}
				}
				scene?.sync(world, { reducedMotion: motion.matches });
				scene?.render(now);
				frames += 1;
				if (now - fpsAt >= 1000) {
					fpsLabel = String(frames);
					frames = 0;
					fpsAt = now;
				}
				paint(canvas, scene);
				raf = requestAnimationFrame(loop);
			};
			raf = requestAnimationFrame(loop);
		})();

		window.addEventListener('keydown', onKeyDown);
		stage.addEventListener('pointerdown', onDown);
		stage.addEventListener('pointermove', onMove);
		stage.addEventListener('pointerup', onUp);
		stage.addEventListener('pointercancel', onUp);
		window.addEventListener('pagehide', save);
		const interval = setInterval(save, 4000);
		return () => {
			cancelled = true;
			cancelAnimationFrame(raf);
			clearInterval(interval);
			resizeObserver?.disconnect();
			window.removeEventListener('keydown', onKeyDown);
			stage.removeEventListener('pointerdown', onDown);
			stage.removeEventListener('pointermove', onMove);
			stage.removeEventListener('pointerup', onUp);
			stage.removeEventListener('pointercancel', onUp);
			window.removeEventListener('pagehide', save);
			scene?.dispose();
			stopShelfAudio();
			save();
		};
	});
</script>

<svelte:head>
	<title>轻心 · {title}</title>
</svelte:head>

<div class="shelf-play">
	<header class="top qx-glass">
		<a href="/modules/games" class="{LINK_CLASS} shrink-0">← 返回目录</a>
		<h1 class="sr-only">{title}</h1>
		<ul class="stats" aria-label="书房进度">
			<li><b>{world.round + 1}</b><span>轮次</span></li>
			<li><b>{heldTitle()}</b><span>手里</span></li>
			<li><b>{PHASE_LABEL[shelfPhase(world)]}</b><span>书柜</span></li>
		</ul>
		<div class="top-actions">
			<Button variant="secondary" class="px-4" onclick={togglePause}>
				{world.paused ? '继续' : '暂停'}
			</Button>
			<Button variant="secondary" class="px-4" onclick={toggleDock}>
				{world.dockCollapsed ? '展开操作' : '收起操作'}
			</Button>
		</div>
	</header>

	<div bind:this={stageEl} class="stage" data-play="shelf">
		<canvas bind:this={canvasEl} class="h-full w-full" aria-label="记忆货架书房"></canvas>
		{#each bubbles as bubble (bubble.id)}
			<p class="sorry" data-apology="1" style="left: {bubble.x}%; top: {bubble.y}%">
				对不起！<small>sorry</small>
			</p>
		{/each}
		<p class="sr-only" aria-live="polite">{world.notice}</p>
		{#if sceneFailed}
			<p class="fail">这台设备画不出三维书房。仍可在格子上拿起、放下，鬼会用平面的脸说对不起。</p>
			<div
				class="flat"
				data-flat="1"
				style="grid-template-columns: repeat({tableOf(world)
					.slots}, minmax(44px, 1fr)); grid-template-rows: repeat({tableOf(world)
					.rows}, minmax(44px, 1fr));"
			>
				{#each visibleItems(world) as item (item.id)}
					<button
						type="button"
						class="cell"
						style="grid-row: {tableOf(world).rows - item.row}; grid-column: {item.slot + 1}"
						onclick={() => {
							if (world.heldId) placeHeld(world, item.row, item.slot);
							else pickItem(world, item.id);
							save();
							paint();
						}}
					>
						<span class="spine">{item.title}</span>
						{#if hauntOf(world, item.id) && hauntOf(world, item.id)?.phase !== 'idle'}
							<span
								class="face"
								class:cry={hauntOf(world, item.id)?.phase === 'cry' ||
									hauntOf(world, item.id)?.phase === 'sorry'}
								aria-hidden="true"
							></span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#if !world.dockCollapsed}
		<section class="dock qx-glass" aria-label="书房操作">
			<p class="notice" aria-live="polite">{world.notice}</p>
			<p class="need">
				点一下拿起，再点或拖到格子上放下。最多四只鬼会同时道歉。没有计时，也没有分数。
			</p>
			<div class="actions">
				<Button class="min-h-12 px-5" onclick={goNext}>下一轮</Button>
				<Button class="min-h-12 px-5" variant="secondary" onclick={toggleDetail}>
					{world.lowDetail ? '高细腻' : '低细腻'}
				</Button>
				<Button class="min-h-12 px-5" variant="secondary" onclick={toggleAudio}>
					{audioOn ? '静音' : '书房声'}
				</Button>
				<Button class="min-h-12 px-5" variant="secondary" onclick={restart}>重新开始</Button>
			</div>
		</section>
	{/if}
</div>

<style>
	.shelf-play {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100dvh;
		min-height: 0;
		overflow: hidden;
		background: #140e0a;
		user-select: none;
		-webkit-user-select: none;
	}

	.top {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin: 0.4rem 0.65rem 0;
		padding: 0.4rem 0.6rem;
		padding-top: max(0.4rem, env(safe-area-inset-top, 0px));
		border-radius: 1.15rem;
		z-index: 10;
	}

	.stats {
		display: flex;
		flex: 1;
		justify-content: center;
		gap: 1rem;
		min-width: 0;
		font-variant-numeric: tabular-nums;
	}

	.stats li {
		display: flex;
		flex-direction: column;
		align-items: center;
		white-space: nowrap;
		font-weight: 600;
		line-height: 1.15;
	}

	.stats span {
		font-size: 0.65rem;
		font-weight: 500;
		color: var(--qx-muted);
	}

	.top-actions {
		display: flex;
		gap: 0.35rem;
		flex-shrink: 0;
	}

	.stage {
		position: relative;
		flex: 1;
		min-height: 0;
		touch-action: none;
		cursor: grab;
	}

	.stage:active {
		cursor: grabbing;
	}

	.sorry {
		position: absolute;
		z-index: 4;
		translate: -50% -120%;
		margin: 0;
		padding: 0.45rem 0.85rem 0.4rem;
		border-radius: 1.1rem 1.1rem 1.1rem 0.35rem;
		background: #fff6e8;
		color: #4a1d6a;
		font-size: 1.65rem;
		font-weight: 800;
		line-height: 1.1;
		letter-spacing: 0.04em;
		box-shadow: 0 10px 28px rgb(40 16 8 / 0.35);
		pointer-events: none;
		text-wrap: balance;
	}

	.sorry small {
		display: block;
		margin-top: 0.12rem;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		color: #7c3aed;
		text-transform: lowercase;
	}

	.fail {
		position: absolute;
		top: 0.4rem;
		left: 0.6rem;
		right: 0.6rem;
		z-index: 3;
		margin: 0;
		padding: 0.35rem 0.55rem;
		text-align: center;
		color: var(--qx-muted);
		font-size: 0.82rem;
	}

	.flat {
		position: absolute;
		inset: 12% 6% 10%;
		z-index: 2;
		display: grid;
		gap: 0.2rem;
		pointer-events: auto;
	}

	.cell {
		position: relative;
		min-width: 44px;
		min-height: 44px;
		padding: 0.15rem;
		border: 1px solid rgb(201 162 39 / 0.35);
		border-radius: 0.35rem;
		background: #5a341c;
		color: #f7ecd2;
		font-size: 0.68rem;
		line-height: 1.1;
	}

	.spine {
		display: block;
		writing-mode: vertical-rl;
	}

	.face {
		position: absolute;
		right: 0.15rem;
		top: 0.2rem;
		width: 0.7rem;
		height: 0.85rem;
		border-radius: 50% 50% 45% 45%;
		background: #e8f4ff;
		box-shadow: inset 0 -0.12rem 0 #c4b5fd;
	}

	.face.cry {
		background: #dbeafe;
	}

	.dock {
		flex-shrink: 0;
		margin: 0.35rem 0.65rem max(0.4rem, env(safe-area-inset-bottom, 0px));
		padding: 0.7rem 0.75rem 0.65rem;
		border-radius: 1.35rem;
		z-index: 10;
	}

	.notice {
		margin: 0;
		font-size: 0.85rem;
		color: var(--qx-muted);
	}

	.need {
		margin: 0.25rem 0 0;
		font-size: 0.95rem;
		font-weight: 600;
		text-wrap: pretty;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.55rem;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@media (pointer: coarse) {
		.actions :global(button),
		.top-actions :global(button) {
			min-width: 44px;
			min-height: 44px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sorry {
			translate: -50% -110%;
		}
	}

	@media (max-width: 430px) {
		.stats {
			gap: 0.4rem;
		}

		.stats span {
			font-size: 0.58rem;
		}

		.top-actions :global(button) {
			min-width: 0;
			padding-inline: 0.7rem;
		}

		.sorry {
			font-size: 1.35rem;
		}
	}
</style>

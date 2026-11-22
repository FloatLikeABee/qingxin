<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import { CONTROL_MIN_PX, LINK_CLASS } from '#lib/ui/affordance';
	import { setKitchenMuted, setKitchenSizzle, stopKitchenAudio, unlockKitchenAudio } from './audio';
	import { readKitchenSave, writeKitchenSave } from './persist';
	import type { KitchenHit, KitchenScene } from './render';
	import {
		dropOnPan,
		dropOnPlate,
		FOOD_KINDS,
		FOOD_LABEL,
		HEAT_LABEL,
		heldKind,
		kitchenSteaming,
		maxDoneness,
		PAN_CAP,
		pickBowl,
		pickPanPiece,
		pieceColor,
		PLATE_CAP,
		restartKitchen,
		setHeat,
		stepKitchen,
		stirPan,
		washPlates,
		type FoodKind,
		type Heat,
		type KitchenWorld
	} from './sim';

	const DRAG_PX = 12;
	const HEATS: Heat[] = ['low', 'high', 'off'];

	let { title }: { title: string } = $props();

	let world = $state<KitchenWorld>(readKitchenSave());
	let sceneFailed = $state(false);
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let stageEl = $state<HTMLDivElement | null>(null);
	let audioOn = $state(false);
	let fpsLabel = $state('—');

	function save() {
		writeKitchenSave(world);
	}

	function hex(color: number) {
		return `#${color.toString(16).padStart(6, '0')}`;
	}

	function heldText() {
		const kind = heldKind(world);
		if (!kind) return '空手';
		return FOOD_LABEL[kind];
	}

	function paint(canvas: HTMLCanvasElement | null = canvasEl, scene: KitchenScene | null = null) {
		if (!canvas) return;
		canvas.dataset.ready = canvas.dataset.ready || '0';
		canvas.dataset.pan = String(world.pan.length);
		canvas.dataset.plated = String(world.plated.length);
		canvas.dataset.heat = world.heat;
		canvas.dataset.doneness = String(Math.round(maxDoneness(world) * 1000) / 1000);
		canvas.dataset.held = world.held
			? world.held.source === 'bowl'
				? `bowl:${world.held.kind}`
				: `pan:${world.held.id}`
			: '';
		canvas.dataset.steam = kitchenSteaming(world) ? '1' : '0';
		canvas.dataset.notice = world.notice;
		canvas.dataset.anim = world.paused ? '0' : '1';
		canvas.dataset.detail = world.lowDetail ? 'low' : 'high';
		canvas.dataset.audio = audioOn ? '1' : '0';
		canvas.dataset.fps = fpsLabel;
		canvas.dataset.cap = String(PAN_CAP);
		canvas.dataset.platecap = String(PLATE_CAP);
		if (scene) {
			for (const kind of FOOD_KINDS) {
				const pt = scene.projectBowl(kind);
				if (pt) {
					canvas.setAttribute(`data-bx-${kind}`, String(Math.round(pt.x)));
					canvas.setAttribute(`data-by-${kind}`, String(Math.round(pt.y)));
				}
			}
			const pan = scene.projectPan();
			if (pan) {
				canvas.dataset.panx = String(Math.round(pan.x));
				canvas.dataset.pany = String(Math.round(pan.y));
			}
			for (let i = 0; i < 8; i++) {
				const pt = scene.projectPlate(i);
				if (pt) {
					canvas.dataset[`plx${i}`] = String(Math.round(pt.x));
					canvas.dataset[`ply${i}`] = String(Math.round(pt.y));
				}
			}
			world.pan.forEach((piece, i) => {
				const pt = scene.projectPiece(piece.id);
				if (pt) {
					canvas.dataset[`px${i}`] = String(Math.round(pt.x));
					canvas.dataset[`py${i}`] = String(Math.round(pt.y));
				}
			});
		}
	}

	function applyHit(hit: KitchenHit | null, moved: boolean, pickedThisDown: boolean) {
		if (!hit) {
			if (!pickedThisDown && world.held && !moved) world.held = null;
			return;
		}
		if (hit.zone === 'bowl' && !world.held) {
			pickBowl(world, hit.kind);
			return;
		}
		if (hit.zone === 'piece' && !world.held) {
			pickPanPiece(world, hit.id);
			return;
		}
		if (world.held?.source === 'bowl' && (hit.zone === 'pan' || hit.zone === 'piece')) {
			dropOnPan(world, hit.x, hit.z);
			return;
		}
		if (world.held?.source === 'pan' && hit.zone === 'pan') {
			if (moved) stirPan(world, world.held.id, hit.x, hit.z);
			dropOnPan(world, hit.x, hit.z);
			return;
		}
		if (world.held?.source === 'pan' && hit.zone === 'plate') {
			dropOnPlate(world, hit.slot);
			return;
		}
		if (world.held?.source === 'pan' && hit.zone === 'piece') {
			dropOnPan(world, hit.x, hit.z);
		}
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
		save();
		paint();
	}

	async function toggleAudio() {
		if (!audioOn) {
			const ok = await unlockKitchenAudio();
			if (!ok) return;
			audioOn = true;
			world.audioWanted = true;
			setKitchenMuted(false);
			save();
			paint();
			return;
		}
		audioOn = false;
		world.audioWanted = false;
		setKitchenMuted(true);
		save();
		paint();
	}

	function restart() {
		restartKitchen(world);
		save();
		paint();
	}

	function wash() {
		washPlates(world);
		save();
		paint();
	}

	function heatTo(next: Heat) {
		setHeat(world, next);
		save();
		paint();
	}

	function flatPick(kind: FoodKind) {
		pickBowl(world, kind);
		save();
		paint();
	}

	function flatPan() {
		if (world.held?.source === 'bowl') dropOnPan(world, 0, 0);
		save();
		paint();
	}

	function flatPlate(slot: number) {
		if (world.held?.source === 'pan') dropOnPlate(world, slot);
		else if (world.pan[0]) {
			pickPanPiece(world, world.pan[0].id);
			dropOnPlate(world, slot);
		}
		save();
		paint();
	}

	onMount(() => {
		world = readKitchenSave();
		if (world.audioWanted) world.audioWanted = false;
		let scene: KitchenScene | null = null;
		let raf = 0;
		let last = performance.now();
		let frames = 0;
		let fpsAt = performance.now();
		const canvas = canvasEl;
		const stage = stageEl;
		if (!canvas || !stage) return;
		let cancelled = false;
		let resizeObserver: ResizeObserver | undefined;
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

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
			const hit = scene?.hit(event.clientX, event.clientY) ?? null;
			if (!world.held && (hit?.zone === 'bowl' || hit?.zone === 'piece')) {
				applyHit(hit, false, true);
				pickedThisDown = true;
				save();
			}
			paint(canvas, scene);
		};
		const markMoved = (x: number, y: number) => {
			if (Math.hypot(x - startX, y - startY) > DRAG_PX) moved = true;
		};
		const onMove = (event: PointerEvent) => {
			if (!pointerDown) return;
			markMoved(event.clientX, event.clientY);
			if (moved && world.held?.source === 'pan') {
				const hit = scene?.hit(event.clientX, event.clientY);
				if (hit?.zone === 'pan' || hit?.zone === 'piece')
					stirPan(world, world.held.id, hit.x, hit.z);
			}
		};
		const onUp = (event: PointerEvent) => {
			if (!pointerDown) return;
			markMoved(event.clientX, event.clientY);
			pointerDown = false;
			try {
				stage.releasePointerCapture(event.pointerId);
			} catch {
				// already released
			}
			if (world.paused) {
				paint(canvas, scene);
				return;
			}
			if (pickedThisDown && !moved) {
				paint(canvas, scene);
				return;
			}
			const hit = scene?.hit(event.clientX, event.clientY) ?? null;
			applyHit(hit, moved, pickedThisDown);
			save();
			paint(canvas, scene);
		};

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
				return;
			if (event.key === 'p' || event.key === 'P') togglePause();
		};

		void (async () => {
			const { mountKitchenScene } = await import('./render');
			if (cancelled) return;
			scene = mountKitchenScene(canvas);
			if (!scene) sceneFailed = true;
			else scene.resize();
			canvas.dataset.ready = '1';
			scene?.sync(world, { reducedMotion: motion.matches });
			paint(canvas, scene);
			resizeObserver = new ResizeObserver(() => {
				scene?.resize();
				paint(canvas, scene);
			});
			resizeObserver.observe(stage);
			const loop = (now: number) => {
				const dt = Math.min(48, now - last);
				last = now;
				if (!world.paused && !document.hidden) stepKitchen(world, dt);
				scene?.sync(world, { reducedMotion: motion.matches });
				scene?.render(now);
				if (audioOn) setKitchenSizzle(world.heat, world.pan.length);
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
		window.addEventListener('pointermove', onMove);
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
			window.removeEventListener('pointermove', onMove);
			stage.removeEventListener('pointerup', onUp);
			stage.removeEventListener('pointercancel', onUp);
			window.removeEventListener('pagehide', save);
			scene?.dispose();
			stopKitchenAudio();
			save();
		};
	});
</script>

<svelte:head>
	<title>轻心 · {title}</title>
</svelte:head>

<div class="kitchen-play">
	<header class="top qx-glass" data-kitchen-top="1">
		<a href="/modules/games" class="{LINK_CLASS} shrink-0">← 返回目录</a>
		<h1 class="sr-only">{title}</h1>
		<ul class="stats" aria-label="厨房进度">
			<li><b>{world.pan.length}/{PAN_CAP}</b><span>锅里</span></li>
			<li><b>{heldText()}</b><span>手里</span></li>
			<li><b>{HEAT_LABEL[world.heat]}</b><span>火候</span></li>
			<li><b>{world.plated.length}/{PLATE_CAP}</b><span>盘子</span></li>
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

	<div bind:this={stageEl} class="stage" data-play="kitchen">
		<canvas bind:this={canvasEl} class="h-full w-full" aria-label="家庭厨房灶台"></canvas>
		<p class="sr-only" aria-live="polite">{world.notice}</p>
		{#if sceneFailed}
			<p class="fail">这台设备画不出三维灶台。仍可把食材点进锅里，熟了再盛盘。</p>
			<div class="flat" data-flat="1">
				<div class="flat-bowls">
					{#each FOOD_KINDS as kind (kind)}
						<button
							type="button"
							class="chip"
							style="background:{hex(pieceColor(kind, 0))}"
							onclick={() => flatPick(kind)}>{FOOD_LABEL[kind]}</button
						>
					{/each}
				</div>
				<button type="button" class="flat-pan" onclick={flatPan}>
					锅 {world.pan.length}/{PAN_CAP}
					{#each world.pan as piece (piece.id)}
						<span
							class="dot"
							style="background:{hex(
								pieceColor(piece.kind, piece.doneness)
							)}; transform: scaleY({0.55 + 0.45 * (1 - piece.doneness)})"
						></span>
					{/each}
				</button>
				<div class="flat-plates">
					{#each Array(PLATE_CAP) as _, slot (slot)}
						<button type="button" class="chip plate" onclick={() => flatPlate(slot)}>
							{world.plated.find((d) => d.slot === slot)?.label ?? `盘 ${slot + 1}`}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	{#if !world.dockCollapsed}
		<section class="dock qx-glass" aria-label="厨房操作">
			<p class="notice" aria-live="polite">{world.notice}</p>
			<p class="need">
				从碗里拖到锅里炒，再盛到盘子上。没有订单，也没有倒计时。锅最多十二份，盘子最多八盘。
			</p>
			<div class="heat" role="group" aria-label="火候">
				{#each HEATS as heat (heat)}
					<button
						type="button"
						class="heat-chip"
						class:on={world.heat === heat}
						style="min-width:{CONTROL_MIN_PX}px;min-height:{CONTROL_MIN_PX}px"
						aria-pressed={world.heat === heat}
						onclick={() => heatTo(heat)}
					>
						{HEAT_LABEL[heat]}
					</button>
				{/each}
			</div>
			<div class="actions">
				<Button class="min-h-12 px-5" variant="secondary" onclick={toggleDetail}>
					{world.lowDetail ? '高细腻' : '低细腻'}
				</Button>
				<Button class="min-h-12 px-5" variant="secondary" onclick={toggleAudio}>
					{audioOn ? '静音' : '锅气'}
				</Button>
				<Button class="min-h-12 px-5" variant="secondary" onclick={wash}>洗碗</Button>
				<Button class="min-h-12 px-5" variant="secondary" onclick={restart}>重新开始</Button>
			</div>
		</section>
	{/if}
</div>

<style>
	.kitchen-play {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100dvh;
		min-height: 0;
		overflow: hidden;
		background: #f3e4c8;
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
		gap: 0.85rem;
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

	@media (max-width: 640px) {
		.top {
			flex-wrap: wrap;
		}

		.stats {
			order: 3;
			flex: 1 0 100%;
			justify-content: space-around;
			gap: 0.35rem;
		}

		.top-actions {
			margin-left: auto;
		}
	}

	.stage {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow: hidden;
		touch-action: none;
		cursor: grab;
	}

	.stage:active {
		cursor: grabbing;
	}

	.fail {
		position: absolute;
		left: 0.8rem;
		right: 0.8rem;
		top: 0.6rem;
		margin: 0;
		text-wrap: pretty;
	}

	.flat {
		position: absolute;
		inset: 2.6rem 0.7rem 0.7rem;
		display: grid;
		gap: 0.6rem;
		grid-template-rows: auto 1fr auto;
	}

	.flat-bowls,
	.flat-plates,
	.heat,
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.chip,
	.heat-chip {
		min-width: 44px;
		min-height: 44px;
		border-radius: 0.85rem;
		border: 0;
		padding: 0.35rem 0.7rem;
		font-weight: 600;
	}

	.flat-pan {
		border: 0;
		border-radius: 1.2rem;
		background: #2b2b2e;
		color: #f8efe2;
		min-height: 120px;
		display: flex;
		flex-wrap: wrap;
		align-content: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.8rem;
	}

	.dot {
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 999px;
		display: inline-block;
	}

	.dock {
		margin: 0 0.65rem 0.55rem;
		padding: 0.65rem 0.75rem;
		padding-bottom: max(0.65rem, env(safe-area-inset-bottom, 0px));
		border-radius: 1.15rem;
		z-index: 10;
	}

	.notice {
		margin: 0 0 0.25rem;
		font-weight: 650;
		text-wrap: pretty;
	}

	.need {
		margin: 0 0 0.55rem;
		color: var(--qx-muted);
		font-size: 0.92rem;
		text-wrap: pretty;
	}

	.heat-chip {
		background: color-mix(in srgb, var(--qx-card) 70%, #f4d7a8);
	}

	.heat-chip.on {
		background: #e36b2a;
		color: white;
	}

	@media (pointer: coarse) {
		.heat-chip,
		.chip {
			min-block-size: 44px;
			min-inline-size: 44px;
		}
	}
</style>

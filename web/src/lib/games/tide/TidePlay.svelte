<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import {
		chimeTide,
		setTideMuted,
		setTideSwellGain,
		stopTideAudio,
		unlockTideAudio
	} from './audio';
	import { readTideSave, writeTideSave } from './persist';
	import type { TideScene } from './render';
	import {
		HAUL_KINDS,
		STAR_COUNT,
		clearSteer,
		cycleCreature,
		holdTide,
		nudgeTide,
		restartTide,
		selectCreature,
		setTideKey,
		stepTide,
		steerTide,
		type TideWorld
	} from './sim';

	let { title }: { title: string } = $props();

	let world = $state<TideWorld>(readTideSave());
	let sceneFailed = $state(false);
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let stageEl = $state<HTMLDivElement | null>(null);
	let audioOn = $state(false);
	let lastCollected = 0;

	function save() {
		writeTideSave(world);
	}

	function paint(canvas: HTMLCanvasElement | null = canvasEl) {
		if (!canvas) return;
		canvas.dataset.swell = world.swell.toFixed(2);
		canvas.dataset.pulse = world.pulse.toFixed(2);
		canvas.dataset.stars = String(world.collected);
		canvas.dataset.coral = String(world.coral.filter((c) => c.unlocked).length);
		canvas.dataset.holding = world.holding ? '1' : '0';
		canvas.dataset.detail = world.lowDetail ? 'low' : 'high';
		canvas.dataset.anim = world.paused ? '0' : '1';
		canvas.dataset.audio = audioOn ? '1' : '0';
		canvas.dataset.sky = '1';
		canvas.dataset.constellations = '4';
		canvas.dataset.hauls = String(HAUL_KINDS.length);
	}

	function togglePause() {
		world.paused = !world.paused;
		if (world.paused) holdTide(world, false);
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
			const ok = await unlockTideAudio();
			if (!ok) return;
			audioOn = true;
			world.audioWanted = true;
			setTideMuted(false);
			save();
			paint();
			return;
		}
		audioOn = false;
		setTideMuted(true);
		paint();
	}

	function restart() {
		restartTide(world);
		lastCollected = 0;
		save();
		paint();
	}

	onMount(() => {
		world = readTideSave();
		lastCollected = world.collected;
		let scene: TideScene | null = null;
		let raf = 0;
		let last = performance.now();
		const canvas = canvasEl;
		const stage = stageEl;
		if (!canvas || !stage) return;
		let resizeObserver: ResizeObserver | undefined;
		let cancelled = false;
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

		const onDown = (event: PointerEvent) => {
			if (event.pointerType === 'mouse' && event.button !== 0) return;
			if (world.paused) return;
			const id = scene?.pickCreature(event.clientX, event.clientY);
			if (id != null) selectCreature(world, id);
			const hit = scene?.hitWater(event.clientX, event.clientY);
			if (hit) steerTide(world, hit.x, hit.z);
			holdTide(world, true);
			stage.setPointerCapture(event.pointerId);
			paint();
		};
		const onMove = (event: PointerEvent) => {
			if (!world.holding) return;
			const hit = scene?.hitWater(event.clientX, event.clientY);
			if (hit) steerTide(world, hit.x, hit.z);
		};
		const onUp = () => {
			if (!world.holding) return;
			holdTide(world, false);
			clearSteer(world);
			paint();
			save();
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
				return;
			if (event.code === 'Space') {
				event.preventDefault();
				if (!event.repeat && !world.paused) holdTide(world, true);
			}
			if (event.key === 'ArrowUp') {
				event.preventDefault();
				setTideKey(world, 'up', true);
				nudgeTide(world, 0, -1);
			}
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				setTideKey(world, 'down', true);
				nudgeTide(world, 0, 1);
			}
			if (event.key === 'ArrowLeft') {
				event.preventDefault();
				setTideKey(world, 'left', true);
				nudgeTide(world, -1, 0);
			}
			if (event.key === 'ArrowRight') {
				event.preventDefault();
				setTideKey(world, 'right', true);
				nudgeTide(world, 1, 0);
			}
			if (event.key === '[') cycleCreature(world, -1);
			if (event.key === ']') cycleCreature(world, 1);
			if (event.key === 'p' || event.key === 'P') togglePause();
			paint();
		};
		const onKeyUp = (event: KeyboardEvent) => {
			if (event.code === 'Space') {
				event.preventDefault();
				holdTide(world, false);
				paint();
				save();
			}
			if (event.key === 'ArrowUp') setTideKey(world, 'up', false);
			if (event.key === 'ArrowDown') setTideKey(world, 'down', false);
			if (event.key === 'ArrowLeft') setTideKey(world, 'left', false);
			if (event.key === 'ArrowRight') setTideKey(world, 'right', false);
		};

		void (async () => {
			const { mountTideScene } = await import('./render');
			if (cancelled) return;
			scene = mountTideScene(canvas);
			if (!scene) {
				sceneFailed = true;
				paint();
				return;
			}
			scene.resize();
			canvas.dataset.ready = '1';
			scene.sync(world, { reducedMotion: motion.matches });
			paint();
			resizeObserver = new ResizeObserver(() => scene?.resize());
			resizeObserver.observe(stage);
			const loop = (now: number) => {
				const dt = Math.min(48, now - last);
				last = now;
				if (!world.paused && !document.hidden) {
					stepTide(world, dt);
					if (world.collected > lastCollected) {
						chimeTide();
						lastCollected = world.collected;
						save();
					}
					setTideSwellGain(world.swell);
				}
				scene?.sync(world, { reducedMotion: motion.matches });
				scene?.render(now);
				paint(canvas);
				raf = requestAnimationFrame(loop);
			};
			raf = requestAnimationFrame(loop);
		})();

		const onVis = () => {
			if (document.hidden) {
				world.paused = true;
				holdTide(world, false);
				paint();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		stage.addEventListener('pointerdown', onDown);
		stage.addEventListener('pointermove', onMove);
		stage.addEventListener('pointerup', onUp);
		stage.addEventListener('pointercancel', onUp);
		document.addEventListener('visibilitychange', onVis);
		window.addEventListener('pagehide', save);
		const interval = setInterval(save, 4000);
		return () => {
			cancelled = true;
			cancelAnimationFrame(raf);
			clearInterval(interval);
			resizeObserver?.disconnect();
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			stage.removeEventListener('pointerdown', onDown);
			stage.removeEventListener('pointermove', onMove);
			stage.removeEventListener('pointerup', onUp);
			stage.removeEventListener('pointercancel', onUp);
			document.removeEventListener('visibilitychange', onVis);
			window.removeEventListener('pagehide', save);
			scene?.dispose();
			stopTideAudio();
			save();
		};
	});
</script>

<svelte:head>
	<title>轻心 · {title}</title>
</svelte:head>

<div class="tide-play">
	<header class="top qx-glass">
		<a href="/modules/games" class="{LINK_CLASS} shrink-0">← 返回目录</a>
		<h1 class="sr-only">{title}</h1>
		<ul class="stats" aria-label="潮汐进度">
			<li><b>{world.collected}</b><span>海光 / {STAR_COUNT}</span></li>
			<li><b>{world.coral.filter((c) => c.unlocked).length}</b><span>珊瑚园</span></li>
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

	<div bind:this={stageEl} class="stage" data-play="tide">
		<canvas bind:this={canvasEl} class="h-full w-full" aria-label="潮汐呼吸夜海"></canvas>
		{#if sceneFailed}
			<p class="fail">这台设备画不出夜海。按住仍可感受潮汐起伏。</p>
		{/if}
		<button type="button" class="sr-only" onclick={() => holdTide(world, !world.holding)}
			>潮汐</button
		>
	</div>

	{#if !world.dockCollapsed}
		<section class="dock qx-glass" aria-label="潮汐操作">
			<p class="notice" aria-live="polite">{world.notice}</p>
			<p class="need">
				按住随潮升起，松开送出波纹。点海面或用方向键引导发光的海物去捡海光。不必憋气。
			</p>
			<div class="pace" aria-hidden="true">
				<span class="pace-ring" style="--pace:{world.paceHint}"></span>
				<span>起伏提示，不是功课</span>
			</div>
			<div class="actions">
				<Button
					class="min-h-12 px-5"
					variant={world.holding ? 'primary' : 'secondary'}
					onpointerdown={() => holdTide(world, true)}
					onpointerup={() => holdTide(world, false)}
					onpointerleave={() => world.holding && holdTide(world, false)}
				>
					{world.holding ? '正在升起' : '按住呼吸潮'}
				</Button>
				<Button class="min-h-12 px-5" variant="secondary" onclick={toggleDetail}>
					{world.lowDetail ? '高细腻' : '低细腻'}
				</Button>
				<Button class="min-h-12 px-5" variant="secondary" onclick={toggleAudio}>
					{audioOn ? '静音' : '海声'}
				</Button>
				<Button class="min-h-12 px-5" variant="secondary" onclick={restart}>重新开始</Button>
			</div>
		</section>
	{/if}
</div>

<style>
	.tide-play {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100dvh;
		min-height: 0;
		overflow: hidden;
		background: #070b14;
	}

	.top {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin: 0.4rem 0.65rem 0;
		padding: 0.4rem 0.6rem;
		padding-top: max(0.4rem, env(safe-area-inset-top));
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
	}

	.fail {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		text-align: center;
		color: var(--qx-muted);
	}

	.dock {
		flex-shrink: 0;
		margin: 0.35rem 0.65rem max(0.4rem, env(safe-area-inset-bottom));
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
	}

	.pace {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		margin-top: 0.45rem;
		font-size: 0.8rem;
		color: var(--qx-muted);
	}

	.pace-ring {
		width: 1.35rem;
		height: 1.35rem;
		border-radius: 999px;
		border: 2px solid color-mix(in oklab, #67e8f9 55%, transparent);
		box-shadow: inset 0 0 0 calc(var(--pace) * 6px) color-mix(in oklab, #38bdf8 45%, transparent);
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

	@media (max-width: 430px) {
		.top-actions :global(button) {
			min-width: 0;
			padding-inline: 0.7rem;
		}
	}
</style>

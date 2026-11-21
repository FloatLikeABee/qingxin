<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import { chimeSky, setSkyAirGain, setSkyMuted, stopSkyAudio, unlockSkyAudio } from './audio';
	import { readSkySave, writeSkySave } from './persist';
	import type { CloudScene } from './render';
	import {
		FRAG_KINDS,
		jumpSky,
		restartSky,
		setSkyKey,
		setSkySteer,
		stepSky,
		type SkyKeys,
		type SkyWorld
	} from './sim';

	let { title }: { title: string } = $props();

	let world = $state<SkyWorld>(readSkySave());
	let sceneFailed = $state(false);
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let stageEl = $state<HTMLDivElement | null>(null);
	let audioOn = $state(false);
	let lastFrags = 0;

	function save() {
		writeSkySave(world);
	}

	function paint(canvas: HTMLCanvasElement | null = canvasEl) {
		if (!canvas) return;
		canvas.dataset.island = String(world.island);
		canvas.dataset.airborne = world.airborne || world.inWind ? '1' : '0';
		canvas.dataset.bounce = world.didBounce ? '1' : '0';
		canvas.dataset.wind = world.didWind ? '1' : '0';
		canvas.dataset.sky = world.skyMode;
		canvas.dataset.garden = String(world.garden.length);
		canvas.dataset.frags = String(world.fragments.filter((f) => f.collected).length);
		canvas.dataset.anim = world.paused ? '0' : '1';
		canvas.dataset.detail = world.lowDetail ? 'low' : 'high';
		canvas.dataset.audio = audioOn ? '1' : '0';
		canvas.dataset.discovered = String(world.creatures.filter((c) => c.discovered).length);
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
			const ok = await unlockSkyAudio();
			if (!ok) return;
			audioOn = true;
			world.audioWanted = true;
			setSkyMuted(false);
			save();
			paint();
			return;
		}
		audioOn = false;
		setSkyMuted(true);
		paint();
	}

	function restart() {
		restartSky(world);
		lastFrags = 0;
		save();
		paint();
	}

	onMount(() => {
		world = readSkySave();
		lastFrags = world.fragments.filter((f) => f.collected).length;
		let scene: CloudScene | null = null;
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
			const hit = scene?.hitWalk(event.clientX, event.clientY);
			if (hit) setSkySteer(world, hit.x, hit.z);
			stage.setPointerCapture(event.pointerId);
			paint();
		};
		const onMove = (event: PointerEvent) => {
			if (world.paused || event.buttons === 0) return;
			const hit = scene?.hitWalk(event.clientX, event.clientY);
			if (hit) setSkySteer(world, hit.x, hit.z);
		};
		const onUp = () => {
			save();
		};
		const bindKey = (event: KeyboardEvent, down: boolean) => {
			if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
				return;
			const map: Record<string, keyof SkyKeys> = {
				ArrowUp: 'up',
				ArrowDown: 'down',
				ArrowLeft: 'left',
				ArrowRight: 'right',
				KeyW: 'up',
				KeyS: 'down',
				KeyA: 'left',
				KeyD: 'right',
				w: 'up',
				s: 'down',
				a: 'left',
				d: 'right'
			};
			const dir = map[event.code] ?? map[event.key];
			if (dir) {
				event.preventDefault();
				setSkyKey(world, dir, down);
			}
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
				return;
			if (event.code === 'Space') {
				event.preventDefault();
				if (!event.repeat && !world.paused) jumpSky(world);
			}
			bindKey(event, true);
			if (event.key === 'p' || event.key === 'P') togglePause();
			paint();
		};
		const onKeyUp = (event: KeyboardEvent) => {
			if (event.code === 'Space') event.preventDefault();
			bindKey(event, false);
		};

		void (async () => {
			const { mountCloudScene } = await import('./render');
			if (cancelled) return;
			scene = mountCloudScene(canvas);
			if (!scene) sceneFailed = true;
			else scene.resize();
			canvas.dataset.ready = '1';
			scene?.sync(world, { reducedMotion: motion.matches });
			paint();
			resizeObserver = new ResizeObserver(() => scene?.resize());
			resizeObserver.observe(stage);
			const loop = (now: number) => {
				const dt = Math.min(48, now - last);
				last = now;
				if (!world.paused && !document.hidden) {
					stepSky(world, dt);
					const frags = world.fragments.filter((f) => f.collected).length;
					if (frags > lastFrags) {
						chimeSky();
						lastFrags = frags;
						save();
					}
					setSkyAirGain(world.inWind, world.airborne);
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
			stopSkyAudio();
			save();
		};
	});
</script>

<svelte:head>
	<title>轻心 · {title}</title>
</svelte:head>

<div class="cloud-play">
	<header class="top qx-glass">
		<a href="/modules/games" class="{LINK_CLASS} shrink-0">← 返回目录</a>
		<h1 class="sr-only">{title}</h1>
		<ul class="stats" aria-label="云上进度">
			<li>
				<b>{world.fragments.filter((f) => f.collected).length}</b><span
					>碎片 / {FRAG_KINDS.length}</span
				>
			</li>
			<li><b>{world.garden.length}</b><span>云圃</span></li>
			<li><b>{world.visited.length}</b><span>岛屿</span></li>
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

	<div bind:this={stageEl} class="stage" data-play="cloud">
		<canvas bind:this={canvasEl} class="h-full w-full" aria-label="云上散步天空"></canvas>
		{#if sceneFailed}
			<p class="fail">这台设备画不出天空。方向键仍可在岛间走动。</p>
		{/if}
		<button type="button" class="sr-only" onclick={() => jumpSky(world)}>跳</button>
	</div>

	{#if !world.dockCollapsed}
		<section class="dock qx-glass" aria-label="云上操作">
			<p class="notice" aria-live="polite">{world.notice}</p>
			<p class="need">
				方向键或 WASD 走路，空格或点「跳一下」弹起。点地面走过去。风会送你，云会弹起来。没有分数。
			</p>
			<div class="actions">
				<Button class="min-h-12 px-5" variant="secondary" onclick={() => jumpSky(world)}>
					跳一下
				</Button>
				<Button class="min-h-12 px-5" variant="secondary" onclick={toggleDetail}>
					{world.lowDetail ? '高细腻' : '低细腻'}
				</Button>
				<Button class="min-h-12 px-5" variant="secondary" onclick={toggleAudio}>
					{audioOn ? '静音' : '风声'}
				</Button>
				<Button class="min-h-12 px-5" variant="secondary" onclick={restart}>重新开始</Button>
			</div>
		</section>
	{/if}
</div>

<style>
	.cloud-play {
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
		.stats {
			gap: 0.45rem;
		}

		.stats span {
			font-size: 0.58rem;
		}

		.top-actions :global(button) {
			min-width: 0;
			padding-inline: 0.7rem;
		}
	}
</style>

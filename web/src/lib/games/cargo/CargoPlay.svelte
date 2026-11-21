<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import { setHaulEngine, setHaulMuted, stopHaulAudio, unlockHaulAudio } from './audio';
	import { readHaulSave, writeHaulSave } from './persist';
	import type { CargoScene } from './render';
	import {
		haulControlFromKeyboard,
		recoverHaul,
		restartHaul,
		setHaulControl,
		stepHaul,
		type Biome,
		type HaulWorld
	} from './sim';

	const BIOME_LABEL: Record<Biome, string> = {
		highway: '公路',
		city: '城市',
		country: '乡间'
	};

	let { title }: { title: string } = $props();

	let world = $state<HaulWorld>(readHaulSave());
	let sceneFailed = $state(false);
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let stageEl = $state<HTMLDivElement | null>(null);
	let audioOn = $state(false);
	let steerTouch = $state(false);

	function save() {
		writeHaulSave(world);
	}

	function paint(canvas: HTMLCanvasElement | null = canvasEl) {
		if (!canvas) return;
		canvas.dataset.speed = String(Math.round(world.speed * 10) / 10);
		canvas.dataset.yaw = String(Math.round(world.yaw * 1000) / 1000);
		canvas.dataset.x = String(Math.round(world.x * 10) / 10);
		canvas.dataset.z = String(Math.round(world.z * 10) / 10);
		canvas.dataset.biome = world.biome;
		canvas.dataset.onroad = world.onRoad ? '1' : '0';
		canvas.dataset.reverse = world.gear === 'reverse' ? '1' : '0';
		canvas.dataset.paused = world.paused ? '1' : '0';
		canvas.dataset.odometer = String(Math.round(world.odometer));
		canvas.dataset.km = String(Math.round((world.odometer / 1000) * 10) / 10);
		canvas.dataset.fork = world.forkNearby ? '1' : '0';
		canvas.dataset.exitside = world.exitSide;
		canvas.dataset.along = String(Math.round(world.along));
		canvas.dataset.plen = String(Math.round(world.pieceLength));
		canvas.dataset.drift =
			world.lateral > 1.4 ? 'left' : world.lateral < -1.4 ? 'right' : '';
		canvas.dataset.recover = String(world.recoverCount);
		canvas.dataset.anim = world.paused ? '0' : '1';
		canvas.dataset.detail = world.lowDetail ? 'low' : 'high';
		canvas.dataset.audio = audioOn ? '1' : '0';
		canvas.dataset.hidden = document.hidden ? '1' : '0';
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
			const ok = await unlockHaulAudio();
			if (!ok) return;
			audioOn = true;
			world.audioWanted = true;
			setHaulMuted(false);
			save();
			paint();
			return;
		}
		audioOn = false;
		setHaulMuted(true);
		paint();
	}

	function restart() {
		restartHaul(world);
		save();
		paint();
	}

	function toggleReverse() {
		world.gear = world.gear === 'reverse' ? 'drive' : 'reverse';
		setHaulControl(world, 'reverse', world.gear === 'reverse' ? 1 : 0);
		paint();
	}

	function recover() {
		recoverHaul(world);
		save();
		paint();
	}

	function kmLabel(meters: number) {
		return `${(meters / 1000).toFixed(1)} km`;
	}

	onMount(() => {
		world = readHaulSave();
		let scene: CargoScene | null = null;
		let raf = 0;
		let last = performance.now();
		const canvas = canvasEl;
		const stage = stageEl;
		if (!canvas || !stage) return;
		let resizeObserver: ResizeObserver | undefined;
		let cancelled = false;
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		world.reducedMotion = motion.matches;

		const onSteer = (event: PointerEvent) => {
			if (world.paused) return;
			const box = stage.getBoundingClientRect();
			const nx = (event.clientX - box.left) / Math.max(1, box.width * 0.66);
			if (nx > 1.05) return;
			steerTouch = true;
			setHaulControl(world, 'steer', Math.max(-1, Math.min(1, nx * 2 - 1)));
			paint();
		};
		const onDown = (event: PointerEvent) => {
			if (event.pointerType === 'mouse' && event.button !== 0) return;
			const box = stage.getBoundingClientRect();
			if (event.clientX > box.left + box.width * 0.66) return;
			stage.setPointerCapture(event.pointerId);
			onSteer(event);
		};
		const onMove = (event: PointerEvent) => {
			if (!steerTouch && event.buttons === 0) return;
			onSteer(event);
		};
		const onUp = (event: PointerEvent) => {
			if (event.pointerType !== 'mouse') setHaulControl(world, 'steer', 0);
			steerTouch = false;
			save();
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
				return;
			const control = haulControlFromKeyboard(event);
			if (control.pause) {
				event.preventDefault();
				togglePause();
				return;
			}
			if (control.move === 'reverse') {
				if (!event.repeat) {
					event.preventDefault();
					toggleReverse();
				}
				return;
			}
			if (control.move) {
				event.preventDefault();
				if (!world.paused) setHaulControl(world, control.move, control.value ?? 1);
			}
			paint();
		};
		const onKeyUp = (event: KeyboardEvent) => {
			const control = haulControlFromKeyboard(event);
			if (control.move === 'steer') setHaulControl(world, 'steer', 0);
			if (control.move === 'throttle') setHaulControl(world, 'throttle', 0);
			if (control.move === 'brake') setHaulControl(world, 'brake', 0);
			if (control.move === 'handbrake') setHaulControl(world, 'handbrake', 0);
			paint();
		};

		void (async () => {
			const { mountCargoScene } = await import('./render');
			if (cancelled) return;
			scene = mountCargoScene(canvas);
			if (!scene) sceneFailed = true;
			else scene.resize({ lowDetail: world.lowDetail });
			canvas.dataset.ready = '1';
			scene?.sync(world, { reducedMotion: motion.matches });
			paint();
			resizeObserver = new ResizeObserver(() => scene?.resize({ lowDetail: world.lowDetail }));
			resizeObserver.observe(stage);
			const loop = (now: number) => {
				const dt = Math.min(48, now - last);
				last = now;
				if (!world.paused && !document.hidden) {
					stepHaul(world, dt);
					setHaulEngine(world.speed, false);
				} else {
					setHaulEngine(world.speed, true);
				}
				scene?.sync(world, { reducedMotion: motion.matches });
				scene?.render(now);
				paint(canvas);
				raf = requestAnimationFrame(loop);
			};
			raf = requestAnimationFrame(loop);
		})();

		const onVis = () => {
			paint();
		};
		window.addEventListener('keydown', onKeyDown, true);
		window.addEventListener('keyup', onKeyUp, true);
		stage.focus({ preventScroll: true });
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
			window.removeEventListener('keydown', onKeyDown, true);
			window.removeEventListener('keyup', onKeyUp, true);
			stage.removeEventListener('pointerdown', onDown);
			stage.removeEventListener('pointermove', onMove);
			stage.removeEventListener('pointerup', onUp);
			stage.removeEventListener('pointercancel', onUp);
			document.removeEventListener('visibilitychange', onVis);
			window.removeEventListener('pagehide', save);
			scene?.dispose();
			stopHaulAudio();
			save();
		};
	});
</script>

<svelte:head>
	<title>轻心 · {title}</title>
</svelte:head>

<div class="haul-play">
	<header class="top qx-glass">
		<a href="/modules/games" class="{LINK_CLASS} shrink-0">← 返回目录</a>
		<h1 class="sr-only">{title}</h1>
		<ul class="stats" aria-label="重卡进度">
			<li>
				<b>{kmLabel(world.odometer)}</b><span>里程</span>
			</li>
			<li><b>{Math.abs(world.speed).toFixed(0)}</b><span>km 感</span></li>
			<li><b>{BIOME_LABEL[world.biome]}</b><span>路况</span></li>
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

	<div bind:this={stageEl} class="stage" data-play="cargo" tabindex="-1">
		<canvas bind:this={canvasEl} class="h-full w-full" aria-label="重卡公路"></canvas>
		{#if sceneFailed}
			<p class="fail">这台设备画不出公路。方向键仍可开车。</p>
		{/if}
		<div class="steer-zone" aria-hidden="true"></div>
		<div class="pedals">
			<button
				type="button"
				class="pedal go"
				aria-label="油门"
				onpointerdown={() => setHaulControl(world, 'throttle', 1)}
				onpointerup={() => setHaulControl(world, 'throttle', 0)}
				onpointerleave={() => setHaulControl(world, 'throttle', 0)}
			>
				油门
			</button>
			<button
				type="button"
				class="pedal stop"
				aria-label="刹车"
				onpointerdown={() => setHaulControl(world, 'brake', 1)}
				onpointerup={() => setHaulControl(world, 'brake', 0)}
				onpointerleave={() => setHaulControl(world, 'brake', 0)}
			>
				刹车
			</button>
			<button type="button" class="pedal rev" aria-label="倒车" onclick={toggleReverse}>
				{world.gear === 'reverse' ? '前进' : '倒车'}
			</button>
		</div>
	</div>

	{#if !world.dockCollapsed}
		<section class="dock qx-glass" aria-label="重卡操作">
			<p class="notice" aria-live="polite">{world.notice}</p>
			<p class="need">
				A/D 转向，W 加油，S 刹车，R 倒车，空格手刹。左边划方向盘，右边油门刹车。没有通关。
			</p>
			<div class="actions">
				<Button class="min-h-12 px-5" variant="secondary" onclick={recover}>回收</Button>
				<Button class="min-h-12 px-5" variant="secondary" onclick={toggleReverse}>
					{world.gear === 'reverse' ? '挂前进' : '挂倒车'}
				</Button>
				<Button class="min-h-12 px-5" variant="secondary" onclick={toggleDetail}>
					{world.lowDetail ? '高细腻' : '低细腻'}
				</Button>
				<Button class="min-h-12 px-5" variant="secondary" onclick={toggleAudio}>
					{audioOn ? '静音' : '引擎声'}
				</Button>
				<Button class="min-h-12 px-5" variant="secondary" onclick={restart}>重新开始</Button>
			</div>
		</section>
	{/if}
</div>

<style>
	.haul-play {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100dvh;
		min-height: 0;
		overflow: hidden;
		background: #1a1410;
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
		outline: none;
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

	.steer-zone {
		display: none;
		position: absolute;
		inset: 0 34% 0 0;
		pointer-events: none;
	}

	.pedals {
		display: none;
		position: absolute;
		right: 0.55rem;
		bottom: 0.7rem;
		flex-direction: column;
		gap: 0.4rem;
		z-index: 8;
	}

	.pedal {
		min-width: 44px;
		min-height: 44px;
		padding: 0.55rem 0.85rem;
		border: 0;
		border-radius: 0.9rem;
		font-weight: 700;
		color: white;
		background: color-mix(in srgb, var(--qx-primary) 82%, black);
	}

	.pedal.stop {
		background: color-mix(in srgb, var(--qx-accent-coral) 80%, black);
	}

	.pedal.rev {
		background: color-mix(in srgb, var(--qx-accent-teal) 70%, black);
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

	@media (pointer: coarse) {
		.steer-zone {
			display: block;
		}

		.pedals {
			display: flex;
		}

		.actions :global(button) {
			min-width: 44px;
			min-height: 44px;
		}
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

		.pedals {
			display: flex;
		}

		.steer-zone {
			display: block;
		}
	}
</style>

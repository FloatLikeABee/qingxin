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
	import {
		createHaulPointers,
		haulPointerActive,
		haulPointerCancelAll,
		haulPointerDown,
		haulPointerMove,
		haulPointerUp,
		haulSteerFromPad,
		type HaulPointerKind
	} from './touch';

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
	let wheelEl = $state<HTMLDivElement | null>(null);
	let audioOn = $state(false);
	const pointers = createHaulPointers();
	let keyHeld = {
		steer: 0,
		throttle: false,
		brake: false,
		handbrake: false
	};

	function save() {
		writeHaulSave(world);
	}

	function paint(canvas: HTMLCanvasElement | null = canvasEl) {
		if (!canvas) return;
		const active = haulPointerActive(pointers);
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
		canvas.dataset.drift = world.lateral > 1.4 ? 'left' : world.lateral < -1.4 ? 'right' : '';
		canvas.dataset.recover = String(world.recoverCount);
		canvas.dataset.anim = world.paused ? '0' : '1';
		canvas.dataset.detail = world.lowDetail ? 'low' : 'high';
		canvas.dataset.audio = audioOn ? '1' : '0';
		canvas.dataset.hidden = document.hidden ? '1' : '0';
		canvas.dataset.steer = String(Math.round(world.steerInput * 100) / 100);
		canvas.dataset.throttle = String(world.throttle);
		canvas.dataset.brake = String(world.brake);
		canvas.dataset.steerPtr = String(active.steerHeld ? 1 : 0);
		canvas.dataset.throttlePtr = String(active.throttleHeld ? 1 : 0);
		canvas.dataset.brakePtr = String(active.brakeHeld ? 1 : 0);
		if (wheelEl) {
			wheelEl.dataset.steer = canvas.dataset.steer;
			wheelEl.dataset.held = active.steerHeld ? '1' : '0';
		}
	}

	function applyPointers() {
		const active = haulPointerActive(pointers);
		if (world.paused) {
			setHaulControl(world, 'steer', 0);
			setHaulControl(world, 'throttle', 0);
			setHaulControl(world, 'brake', 0);
			setHaulControl(world, 'handbrake', 0);
			paint();
			return;
		}
		if (active.steerHeld) setHaulControl(world, 'steer', active.steer);
		else setHaulControl(world, 'steer', keyHeld.steer);
		if (active.throttleHeld) setHaulControl(world, 'throttle', 1);
		else setHaulControl(world, 'throttle', keyHeld.throttle ? 1 : 0);
		if (active.brakeHeld) setHaulControl(world, 'brake', 1);
		else setHaulControl(world, 'brake', keyHeld.brake ? 1 : 0);
		paint();
	}

	function releaseTouch(reason: string) {
		haulPointerCancelAll(pointers);
		keyHeld = { steer: 0, throttle: false, brake: false, handbrake: false };
		setHaulControl(world, 'steer', 0);
		setHaulControl(world, 'throttle', 0);
		setHaulControl(world, 'brake', 0);
		setHaulControl(world, 'handbrake', 0);
		if (canvasEl) canvasEl.dataset.release = reason;
		paint();
	}

	function capturePointer(event: PointerEvent) {
		try {
			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		} catch {
			/* Playwright synthetic pointers are not active */
		}
	}

	function onSteerPointer(event: PointerEvent, phase: 'down' | 'move' | 'up') {
		if (phase === 'move' && !pointers.steer.has(event.pointerId)) return;
		event.preventDefault();
		event.stopPropagation();
		if (phase === 'down') capturePointer(event);
		const box = (wheelEl ?? (event.currentTarget as HTMLElement)).getBoundingClientRect();
		const steer = haulSteerFromPad(event.clientX, box.left, box.width);
		if (phase === 'down') haulPointerDown(pointers, 'steer', event.pointerId, steer);
		else if (phase === 'move') haulPointerMove(pointers, event.pointerId, steer);
		else haulPointerUp(pointers, event.pointerId);
		applyPointers();
		if (phase === 'up') save();
	}

	function onPedalPointer(
		kind: Exclude<HaulPointerKind, 'steer'>,
		event: PointerEvent,
		down: boolean
	) {
		event.preventDefault();
		event.stopPropagation();
		if (down) {
			capturePointer(event);
			haulPointerDown(pointers, kind, event.pointerId);
		} else {
			haulPointerUp(pointers, event.pointerId);
		}
		applyPointers();
		if (!down) save();
	}

	function togglePause() {
		world.paused = !world.paused;
		if (world.paused) releaseTouch('pause');
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
		releaseTouch('restart');
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

	const steerNow = $derived(world.steerInput);
	const steerLabel = $derived(steerNow === 0 ? '回正' : steerNow < 0 ? '左转' : '右转');

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
				if (control.move === 'steer') keyHeld.steer = control.value ?? 0;
				if (control.move === 'throttle') keyHeld.throttle = true;
				if (control.move === 'brake') keyHeld.brake = true;
				if (control.move === 'handbrake') keyHeld.handbrake = true;
				if (!world.paused) setHaulControl(world, control.move, control.value ?? 1);
			}
			paint();
		};
		const onKeyUp = (event: KeyboardEvent) => {
			const control = haulControlFromKeyboard(event);
			if (control.move === 'steer') keyHeld.steer = 0;
			if (control.move === 'throttle') keyHeld.throttle = false;
			if (control.move === 'brake') keyHeld.brake = false;
			if (control.move === 'handbrake') keyHeld.handbrake = false;
			applyPointers();
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
			if (document.hidden) releaseTouch('blur');
			else paint();
		};
		const onBlur = () => releaseTouch('blur');
		window.addEventListener('keydown', onKeyDown, true);
		window.addEventListener('keyup', onKeyUp, true);
		window.addEventListener('blur', onBlur);
		stage.focus({ preventScroll: true });
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
			window.removeEventListener('blur', onBlur);
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
	<header class="top qx-glass" data-hud="top">
		<a href="/modules/games" class="{LINK_CLASS} hud-back" data-hud="back">← 返回目录</a>
		<h1 class="sr-only">{title}</h1>
		<ul class="stats" aria-label="重卡进度" data-hud="stats">
			<li data-hud="km">
				<b>{kmLabel(world.odometer)}</b><span>里程</span>
			</li>
			<li data-hud="speed">
				<b>{Math.abs(world.speed).toFixed(0)}</b><span>km 感</span>
			</li>
			<li data-hud="biome">
				<b>{BIOME_LABEL[world.biome]}</b><span>路况</span>
			</li>
		</ul>
		<div class="top-actions" data-hud="actions">
			<Button variant="secondary" class="hud-btn" onclick={togglePause}>
				{world.paused ? '继续' : '暂停'}
			</Button>
			<Button variant="secondary" class="hud-btn" onclick={toggleDock}>
				{world.dockCollapsed ? '展开操作' : '收起操作'}
			</Button>
		</div>
	</header>

	<div bind:this={stageEl} class="stage" data-play="cargo" tabindex="-1">
		<canvas bind:this={canvasEl} class="h-full w-full" aria-label="重卡公路"></canvas>
		{#if sceneFailed}
			<p class="fail">这台设备画不出公路。方向键仍可开车。</p>
		{/if}
		<div
			bind:this={wheelEl}
			class="wheel"
			data-wheel="1"
			data-steer={steerNow}
			role="slider"
			aria-label="方向盘"
			aria-valuemin="-1"
			aria-valuemax="1"
			aria-valuenow={steerNow}
			aria-valuetext={steerLabel}
			tabindex="0"
			onpointerdown={(event) => onSteerPointer(event, 'down')}
			onpointermove={(event) => onSteerPointer(event, 'move')}
			onpointerup={(event) => onSteerPointer(event, 'up')}
			onpointercancel={(event) => onSteerPointer(event, 'up')}
			onlostpointercapture={(event) => onSteerPointer(event, 'up')}
		>
			<div class="wheel-face" style="transform: rotate({steerNow * 78}deg)">
				<span class="spoke"></span>
				<span class="spoke cross"></span>
				<span class="hub"></span>
			</div>
			<span class="wheel-label">{steerLabel}</span>
		</div>
		<div class="pedals">
			<button
				type="button"
				class="pedal go"
				aria-label="油门"
				data-throttle-held={world.throttle > 0 ? '1' : '0'}
				onpointerdown={(event) => onPedalPointer('throttle', event, true)}
				onpointerup={(event) => onPedalPointer('throttle', event, false)}
				onpointercancel={(event) => onPedalPointer('throttle', event, false)}
				onlostpointercapture={(event) => onPedalPointer('throttle', event, false)}
			>
				油门
			</button>
			<button
				type="button"
				class="pedal stop"
				aria-label="刹车"
				onpointerdown={(event) => onPedalPointer('brake', event, true)}
				onpointerup={(event) => onPedalPointer('brake', event, false)}
				onpointercancel={(event) => onPedalPointer('brake', event, false)}
				onlostpointercapture={(event) => onPedalPointer('brake', event, false)}
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
				A/D 转向，W 加油，S 刹车，R 倒车。左边方向盘可回正，右边油门刹车倒车。没有通关。
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
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem 0.5rem;
		margin: 0.4rem 0.65rem 0;
		padding: 0.4rem 0.6rem;
		padding-top: max(0.4rem, env(safe-area-inset-top));
		border-radius: 1.15rem;
		z-index: 10;
		flex-shrink: 0;
	}

	.hud-back {
		flex: 0 0 auto;
	}

	.stats {
		display: flex;
		flex: 1 1 auto;
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
		margin-left: auto;
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

	.wheel {
		display: none;
		position: absolute;
		left: 0.45rem;
		bottom: 0.65rem;
		width: 7.25rem;
		height: 7.25rem;
		z-index: 8;
		touch-action: none;
		pointer-events: auto;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.15rem;
		user-select: none;
	}

	.wheel-face {
		width: 5.6rem;
		height: 5.6rem;
		border-radius: 999px;
		border: 0.55rem solid color-mix(in srgb, var(--qx-primary) 82%, #0b1220);
		background: color-mix(in srgb, #111827 70%, transparent);
		box-shadow:
			0 8px 22px rgba(0, 0, 0, 0.35),
			inset 0 0 0 2px rgba(255, 255, 255, 0.18);
		position: relative;
		pointer-events: none;
	}

	.spoke {
		position: absolute;
		left: 50%;
		top: 18%;
		width: 0.38rem;
		height: 64%;
		margin-left: -0.19rem;
		border-radius: 999px;
		background: color-mix(in srgb, white 70%, var(--qx-primary));
	}

	.spoke.cross {
		transform: rotate(90deg);
	}

	.hub {
		position: absolute;
		inset: 34%;
		border-radius: 999px;
		background: color-mix(in srgb, var(--qx-accent-coral) 70%, #1e293b);
		box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.25);
	}

	.wheel-label {
		font-size: 0.72rem;
		font-weight: 700;
		color: white;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
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
		pointer-events: auto;
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
		touch-action: none;
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
		.wheel,
		.pedals {
			display: flex;
		}

		.actions :global(button) {
			min-width: 44px;
			min-height: 44px;
		}
	}

	@media (max-width: 720px) {
		.top {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: center;
			column-gap: 0.4rem;
			row-gap: 0.28rem;
		}

		.hud-back {
			grid-column: 1;
			grid-row: 1;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.top-actions {
			grid-column: 2;
			grid-row: 1;
			margin-left: 0;
		}

		.stats {
			grid-column: 1 / -1;
			grid-row: 2;
			justify-content: space-around;
			gap: 0.35rem;
			flex: 0 0 auto;
		}

		.wheel,
		.pedals {
			display: flex;
		}

		.top :global(.hud-btn) {
			min-width: 0;
			min-height: 2.5rem;
			padding-inline: 0.55rem;
			font-size: 0.85rem;
		}
	}

	@media (max-width: 430px) {
		.stats span {
			font-size: 0.58rem;
		}

		.dock {
			padding: 0.45rem 0.6rem 0.5rem;
		}

		.notice {
			display: none;
		}

		.need {
			font-size: 0.8rem;
			margin-top: 0;
		}

		.actions {
			margin-top: 0.4rem;
		}

		.wheel {
			width: 6.6rem;
			height: 6.6rem;
		}

		.wheel-face {
			width: 5.1rem;
			height: 5.1rem;
		}
	}
</style>

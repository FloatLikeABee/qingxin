<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import { chimeSky, popSky, setSkyAirGain, setSkyMuted, stopSkyAudio, unlockSkyAudio } from './audio';
	import { rebuildCloud, stepCannon, tryFireSky } from './cannon';
	import { readSkySave, writeSkySave } from './persist';
	import type { CloudScene } from './render';
	import {
		FRAG_KINDS,
		defaultSkyBreakables,
		recallHome,
		releaseSkyControls,
		restartSky,
		setSkyKey,
		setSkySteer,
		skyControlFromKeyboard,
		stepSky,
		type BiomeId,
		type SkyWorld
	} from './sim';

	const BIOME_LABEL: Record<BiomeId, string> = {
		garden: '云圃',
		alien: '异星',
		city: '倒城',
		water: '水色',
		underworld: '潜界'
	};

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

	function paint(canvas: HTMLCanvasElement | null = canvasEl, gpuMs?: number) {
		if (!canvas) return;
		canvas.dataset.island = String(world.island);
		canvas.dataset.airborne = '1';
		canvas.dataset.bounce = world.didBounce ? '1' : '0';
		canvas.dataset.wind = world.didWind ? '1' : '0';
		canvas.dataset.sky = world.skyMode;
		canvas.dataset.garden = String(world.garden.length);
		canvas.dataset.frags = String(world.fragments.filter((f) => f.collected).length);
		canvas.dataset.anim = world.paused ? '0' : '1';
		canvas.dataset.detail = world.lowDetail ? 'low' : 'high';
		canvas.dataset.audio = audioOn ? '1' : '0';
		canvas.dataset.discovered = String(world.creatures.filter((c) => c.discovered).length);
		canvas.dataset.y = String(Math.round(world.y * 10) / 10);
		canvas.dataset.x = String(Math.round(world.x * 10) / 10);
		canvas.dataset.z = String(Math.round(world.z * 10) / 10);
		canvas.dataset.biome = world.biome;
		canvas.dataset.bound = world.bound ? '1' : '0';
		canvas.dataset.r = String(Math.round(Math.hypot(world.x, world.z)));
		canvas.dataset.lookx = String(Math.round(world.lookX * 100) / 100);
		canvas.dataset.lookz = String(Math.round(world.lookZ * 100) / 100);
		canvas.dataset.yaw = String(Math.round(world.yaw * 100) / 100);
		canvas.dataset.rise = world.keys.rise ? '1' : '0';
		canvas.dataset.dive = world.keys.dive ? '1' : '0';
		canvas.dataset.steer = world.steer ? '1' : '0';
		canvas.dataset.fire = world.fireHeld ? '1' : '0';
		canvas.dataset.bullets = String(world.bullets.filter((b) => b.live).length);
		canvas.dataset.shards = String(world.shards.filter((s) => s.live).length);
		canvas.dataset.hidden = String(world.hiddenIds.length);
		canvas.dataset.hiddenids = world.hiddenIds.join(',');
		if (gpuMs != null && Number.isFinite(gpuMs)) {
			canvas.dataset.gpu = String(Math.round(gpuMs * 100) / 100);
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

	function rebuild() {
		rebuildCloud(world);
		save();
		paint();
		stageEl?.focus();
	}

	function holdFire(down: boolean) {
		world.fireHeld = down;
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
		let flyPtr: number | null = null;
		let firePtr: number | null = null;
		let lastFlyX = 0;
		let lastFlyY = 0;
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

		const aimFly = (clientX: number, clientY: number) => {
			const hit = scene?.hitFly(clientX, clientY);
			if (hit) setSkySteer(world, hit.x, hit.y, hit.z);
		};

		const onDown = (event: PointerEvent) => {
			if (world.paused) return;
			if (event.pointerType === 'mouse' && event.button === 2) {
				event.preventDefault();
				world.fireHeld = true;
				firePtr = event.pointerId;
				stage.setPointerCapture(event.pointerId);
				paint();
				return;
			}
			if (event.pointerType === 'mouse' && event.button !== 0) return;
			flyPtr = event.pointerId;
			lastFlyX = event.clientX;
			lastFlyY = event.clientY;
			aimFly(event.clientX, event.clientY);
			stage.setPointerCapture(event.pointerId);
			paint();
		};
		const onMove = (event: PointerEvent) => {
			if (world.paused) return;
			if (event.pointerId !== flyPtr) return;
			lastFlyX = event.clientX;
			lastFlyY = event.clientY;
			aimFly(event.clientX, event.clientY);
		};
		const onUp = (event: PointerEvent) => {
			if (event.pointerId === flyPtr) {
				world.steer = null;
				flyPtr = null;
			}
			if (event.pointerId === firePtr) {
				world.fireHeld = false;
				firePtr = null;
			}
			save();
			paint();
		};
		const onLost = (event: PointerEvent) => onUp(event);
		const onContext = (event: Event) => event.preventDefault();
		const dropControls = () => {
			releaseSkyControls(world);
			flyPtr = null;
			firePtr = null;
			paint();
		};
		const onBlur = () => dropControls();
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
				return;
			const control = skyControlFromKeyboard(event);
			if (control.move) {
				event.preventDefault();
				const vertical = control.move === 'rise' || control.move === 'dive';
				if (!vertical || !world.paused) setSkyKey(world, control.move, true);
			}
			if (control.fire) {
				event.preventDefault();
				world.fireHeld = true;
			}
			if (control.pause) togglePause();
			paint();
		};
		const onKeyUp = (event: KeyboardEvent) => {
			const control = skyControlFromKeyboard(event);
			if (control.move) {
				event.preventDefault();
				setSkyKey(world, control.move, false);
			}
			if (control.fire) {
				world.fireHeld = false;
			}
			paint();
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
					if (flyPtr != null) aimFly(lastFlyX, lastFlyY);
					const hiddenBefore = world.hiddenIds.length;
					stepSky(world, dt);
					const shot = scene?.aim(world) ?? {
						origin: { x: world.x, y: world.y + 0.45, z: world.z },
						dir: { x: world.lookX, y: -0.08, z: world.lookZ }
					};
					tryFireSky(
						world,
						shot.origin,
						{ x: world.lookX, y: -0.08, z: world.lookZ },
						world.t
					);
					stepCannon(world, dt, world.t, scene?.breakables() ?? defaultSkyBreakables());
					if (world.hiddenIds.length > hiddenBefore) popSky();
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
				paint(canvas, scene?.gpuMs);
				raf = requestAnimationFrame(loop);
			};
			raf = requestAnimationFrame(loop);
		})();

		const onVis = () => {
			if (document.hidden) dropControls();
			paint();
		};
		window.addEventListener('keydown', onKeyDown, true);
		window.addEventListener('keyup', onKeyUp, true);
		window.addEventListener('blur', onBlur);
		stage.focus({ preventScroll: true });
		stage.addEventListener('pointerdown', onDown);
		stage.addEventListener('pointermove', onMove);
		stage.addEventListener('pointerup', onUp);
		stage.addEventListener('pointercancel', onUp);
		stage.addEventListener('lostpointercapture', onLost);
		stage.addEventListener('contextmenu', onContext);
		document.addEventListener('visibilitychange', onVis);
		window.addEventListener('pagehide', save);
		const interval = setInterval(save, 4000);
		return () => {
			cancelled = true;
			dropControls();
			cancelAnimationFrame(raf);
			clearInterval(interval);
			resizeObserver?.disconnect();
			window.removeEventListener('keydown', onKeyDown, true);
			window.removeEventListener('keyup', onKeyUp, true);
			window.removeEventListener('blur', onBlur);
			stage.removeEventListener('pointerdown', onDown);
			stage.removeEventListener('pointermove', onMove);
			stage.removeEventListener('pointerup', onUp);
			stage.removeEventListener('pointercancel', onUp);
			stage.removeEventListener('lostpointercapture', onLost);
			stage.removeEventListener('contextmenu', onContext);
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
			<li><b>{BIOME_LABEL[world.biome]}</b><span>所在</span></li>
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

	<div bind:this={stageEl} class="stage" data-play="cloud" tabindex="-1">
		<canvas bind:this={canvasEl} class="h-full w-full" aria-label="云上散步天空"></canvas>
		{#if sceneFailed}
			<p class="fail">这台设备画不出天空。方向键仍可飞升潜入。</p>
		{/if}
	</div>

	{#if !world.dockCollapsed}
		<section class="dock qx-glass" aria-label="云上操作">
			<p class="notice" aria-live="polite">{world.notice}</p>
			<p class="need">
				方向键或 WASD 相对朝向游走。按住空格或「飞升」向上，按住 Shift
				或「潜入」向下。点空中飞过去。F
				或右键或「发射」打碎风景，重建云界还原。没有门，也没有分数。
			</p>
			<div class="actions">
				<Button
					class="min-h-12 min-w-12 px-5"
					variant="secondary"
					onpointerdown={() => setSkyKey(world, 'rise', true)}
					onpointerup={() => {
						setSkyKey(world, 'rise', false);
						stageEl?.focus();
					}}
					onpointerleave={() => setSkyKey(world, 'rise', false)}
				>
					飞升
				</Button>
				<Button
					class="min-h-12 min-w-12 px-5"
					variant="secondary"
					onpointerdown={() => setSkyKey(world, 'dive', true)}
					onpointerup={() => {
						setSkyKey(world, 'dive', false);
						stageEl?.focus();
					}}
					onpointerleave={() => setSkyKey(world, 'dive', false)}
				>
					潜入
				</Button>
				<Button
					class="min-h-12 min-w-12 px-5"
					variant="secondary"
					onpointerdown={() => holdFire(true)}
					onpointerup={() => {
						holdFire(false);
						stageEl?.focus();
					}}
					onpointerleave={() => holdFire(false)}
					onpointercancel={() => holdFire(false)}
				>
					发射
				</Button>
				<Button
					class="min-h-12 px-5"
					variant="secondary"
					onclick={() => {
						recallHome(world);
						stageEl?.focus();
					}}
				>
					回家
				</Button>
				<Button class="min-h-12 px-5" variant="secondary" onclick={rebuild}>重建云界</Button>
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
	}
</style>

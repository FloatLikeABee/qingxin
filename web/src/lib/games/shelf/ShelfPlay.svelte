<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import { chimeShelf, setShelfMuted, stopShelfAudio, unlockShelfAudio } from './audio';
	import { readShelfSave, writeShelfSave } from './persist';
	import type { ShelfScene } from './render';
	import {
		PROP_INFO,
		PUZZLES,
		closeInspect,
		enterRoom,
		enterStudy,
		hintShelf,
		inspectProp,
		matchedCount,
		nextShelf,
		orbitInspect,
		placeInRoom,
		putInSlot,
		rememberShelf,
		restartStudy,
		setFocus,
		stepStudy,
		takeProp,
		type PropKind,
		type StudyWorld
	} from './sim';

	let { title }: { title: string } = $props();

	let world = $state<StudyWorld>(readShelfSave());
	let sceneFailed = $state(false);
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let stageEl = $state<HTMLDivElement | null>(null);
	let audioOn = $state(false);
	let lastMatched = 0;
	let lastPhase: StudyWorld['phase'] = 'observe';
	let dragging = false;
	let lastX = 0;

	function save() {
		writeShelfSave(world);
	}

	function paint(canvas: HTMLCanvasElement | null = canvasEl) {
		if (!canvas) return;
		canvas.dataset.phase = world.phase;
		canvas.dataset.puzzle = String(world.puzzle);
		canvas.dataset.slots = world.slots.map((k) => k ?? '').join(',');
		canvas.dataset.held = world.held ?? '';
		canvas.dataset.inspect = world.inspecting ?? '';
		canvas.dataset.wrong = world.lastWrong ? '1' : '0';
		canvas.dataset.matched = String(matchedCount(world));
		canvas.dataset.unlocked = String(world.unlocked.length);
		canvas.dataset.room = world.room;
		canvas.dataset.arranged = String(world.placements.filter((p) => p.arranged).length);
		canvas.dataset.anim = world.paused ? '0' : '1';
		canvas.dataset.detail = world.lowDetail ? 'low' : 'high';
		canvas.dataset.audio = audioOn ? '1' : '0';
		canvas.dataset.focus = String(world.focus);
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
		restartStudy(world);
		lastMatched = 0;
		lastPhase = world.phase;
		save();
		paint();
	}

	function play(fn: () => void) {
		fn();
		save();
		paint();
	}

	function presentKinds(): PropKind[] {
		const kinds = new Set<PropKind>();
		for (const k of world.slots) if (k) kinds.add(k);
		if (world.held) kinds.add(world.held);
		return [...kinds];
	}

	onMount(() => {
		world = readShelfSave();
		lastMatched = matchedCount(world);
		lastPhase = world.phase;
		let scene: ShelfScene | null = null;
		let raf = 0;
		let last = performance.now();
		const canvas = canvasEl;
		const stage = stageEl;
		if (!canvas || !stage) return;
		let resizeObserver: ResizeObserver | undefined;
		let cancelled = false;
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		world.reducedMotion = motion.matches;

		const onDown = (event: PointerEvent) => {
			if (event.pointerType === 'mouse' && event.button !== 0) return;
			if (world.paused) return;
			const hit = scene?.hit(event.clientX, event.clientY);
			dragging = true;
			lastX = event.clientX;
			stage.setPointerCapture(event.pointerId);
			if (world.inspecting) return;
			if (!hit) return;
			if (world.room === 'collection') {
				if (hit.kind) inspectProp(world, hit.kind);
				if (hit.table && world.inspecting) {
					placeInRoom(world, world.inspecting, hit.table.x, hit.table.z, world.inspectYaw);
					closeInspect(world);
				} else if (hit.table && world.unlocked[0]) {
					placeInRoom(world, world.unlocked[0], hit.table.x, hit.table.z, 0);
				}
				paint();
				return;
			}
			if (hit.kind && world.phase === 'observe') inspectProp(world, hit.kind);
			else if (hit.kind && (world.phase === 'restore' || world.phase === 'cleared')) {
				if (world.held) {
					const slot = world.slots.indexOf(hit.kind);
					if (slot >= 0) putInSlot(world, slot);
				} else takeProp(world, hit.kind);
			} else if (hit.slot != null && world.held) putInSlot(world, hit.slot);
			paint();
		};
		const onMove = (event: PointerEvent) => {
			if (!dragging || world.paused) return;
			if (world.inspecting) {
				orbitInspect(world, (event.clientX - lastX) * 0.01);
				lastX = event.clientX;
				paint();
			}
		};
		const onUp = () => {
			dragging = false;
			save();
		};

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
				return;
			if (event.key === 'Escape') {
				closeInspect(world);
				paint();
				return;
			}
			if (world.inspecting && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
				event.preventDefault();
				orbitInspect(world, event.key === 'ArrowLeft' ? -0.18 : 0.18);
				paint();
				return;
			}
			if (event.key === 'ArrowLeft') {
				event.preventDefault();
				setFocus(world, Math.max(0, world.focus - 1));
			}
			if (event.key === 'ArrowRight') {
				event.preventDefault();
				setFocus(world, Math.min(world.slots.length - 1, world.focus + 1));
			}
			if (event.key === 'Enter') {
				const k = world.slots[world.focus];
				if (k) inspectProp(world, k);
			}
			if (event.code === 'Space') {
				event.preventDefault();
				const k = world.slots[world.focus];
				if (world.held) putInSlot(world, world.focus);
				else if (k) takeProp(world, k);
			}
			if (event.key === 'p' || event.key === 'P') togglePause();
			paint();
		};

		void (async () => {
			const { mountShelfScene } = await import('./render');
			if (cancelled) return;
			scene = mountShelfScene(canvas);
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
					stepStudy(world, dt);
					const matched = matchedCount(world);
					if (world.phase === 'restore' && matched > lastMatched) chimeShelf(true);
					if (world.lastWrong && lastPhase === 'restore') {
						/* chime on rising wrong handled below */
					}
					if (world.phase === 'cleared' && lastPhase !== 'cleared') chimeShelf(true);
					lastMatched = matched;
					lastPhase = world.phase;
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
			stage.removeEventListener('pointerdown', onDown);
			stage.removeEventListener('pointermove', onMove);
			stage.removeEventListener('pointerup', onUp);
			stage.removeEventListener('pointercancel', onUp);
			document.removeEventListener('visibilitychange', onVis);
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
			<li><b>{world.puzzle + 1}</b><span>货架 / {PUZZLES.length}</span></li>
			<li><b>{matchedCount(world)}/{world.goal.length}</b><span>归位</span></li>
			<li><b>{world.unlocked.length}</b><span>收藏</span></li>
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
		{#if sceneFailed}
			<p class="fail">这台设备画不出书房。下面的按钮仍可整理货架。</p>
		{/if}
	</div>

	{#if !world.dockCollapsed}
		<section class="dock qx-glass" aria-label="书房操作">
			<p class="notice" aria-live="polite">{world.notice}</p>
			<p class="need">
				点物件端详，转一转再放下。看清以后按「我记住了」，布帘落下会换位置。凭记忆放回去。没有分数。
			</p>
			<div class="actions">
				{#if world.room === 'study'}
					{#if world.phase === 'observe'}
						<Button class="min-h-12 px-5" onclick={() => play(() => rememberShelf(world))}
							>我记住了</Button
						>
					{/if}
					{#if world.phase === 'restore'}
						<Button
							class="min-h-12 px-5"
							variant="secondary"
							onclick={() => play(() => hintShelf(world))}>提示</Button
						>
					{/if}
					{#if world.phase === 'cleared' && world.puzzle < PUZZLES.length - 1}
						<Button class="min-h-12 px-5" onclick={() => play(() => nextShelf(world))}
							>下一架</Button
						>
					{/if}
					{#each presentKinds() as kind (kind)}
						<Button
							class="min-h-12 px-5"
							variant="secondary"
							onclick={() => play(() => inspectProp(world, kind))}
						>
							端详{PROP_INFO[kind].name}
						</Button>
						{#if world.phase === 'restore'}
							<Button
								class="min-h-12 px-5"
								variant="secondary"
								onclick={() => play(() => takeProp(world, kind))}
							>
								拿起{PROP_INFO[kind].name}
							</Button>
						{/if}
					{/each}
					{#if world.held && world.phase === 'restore'}
						{#each world.slots as _, i (i)}
							<Button
								class="min-h-12 px-5"
								variant="secondary"
								onclick={() => play(() => putInSlot(world, i))}
							>
								放到第{i + 1}格
							</Button>
						{/each}
					{/if}
					{#if world.inspecting}
						<Button
							class="min-h-12 px-5"
							variant="secondary"
							onclick={() => play(() => closeInspect(world))}>放下</Button
						>
					{/if}
					<Button
						class="min-h-12 px-5"
						variant="secondary"
						onclick={() => play(() => enterRoom(world))}>收藏室</Button
					>
				{:else}
					<Button class="min-h-12 px-5" onclick={() => play(() => enterStudy(world))}>回书房</Button
					>
					{#each world.unlocked as kind (kind)}
						<Button
							class="min-h-12 px-5"
							variant="secondary"
							onclick={() => play(() => inspectProp(world, kind))}
						>
							端详{PROP_INFO[kind].name}
						</Button>
						<Button
							class="min-h-12 px-5"
							variant="secondary"
							onclick={() =>
								play(() =>
									placeInRoom(world, kind, (world.unlocked.indexOf(kind) - 1) * 0.7, 0.15, 0.2)
								)}
						>
							摆放{PROP_INFO[kind].name}
						</Button>
					{/each}
				{/if}
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
		max-height: 42dvh;
		overflow: auto;
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
			gap: 0.4rem;
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

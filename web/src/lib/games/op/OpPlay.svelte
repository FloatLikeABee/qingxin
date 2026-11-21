<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import { setOpMuted, stopOpAudio, tickOpTool, unlockOpAudio } from './audio';
	import { loadOpSave, writeOpSave } from './persist';
	import type { OpScene } from './render';
	import {
		ACK_LABEL,
		LOCKED_PARTS,
		PHASES,
		PHASE_LABEL,
		REGIONS,
		TOOL_LABEL,
		WARNING_COPY,
		ackGraphic,
		fieldLayout,
		leaveField,
		legalTools,
		pickRegion,
		pointerDown,
		pointerMove,
		pointerUp,
		replayRegion,
		reseedRegion,
		setOpTool,
		setPaused,
		stepOp,
		type RegionId,
		type ToolId,
		type OpWorld
	} from './sim';

	let { title }: { title: string } = $props();

	let world = $state<OpWorld>(loadOpSave(typeof localStorage === 'undefined' ? null : localStorage).world);
	let sceneFailed = $state(false);
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let stageEl = $state<HTMLDivElement | null>(null);
	let audioOn = $state(false);
	let lastTool = $state<ToolId>(world.tool);

	let scene: OpScene | null = null;
	let raf = 0;
	let last = performance.now();

	const regionList = $derived(Object.values(REGIONS));
	const kit = $derived(world.region ? REGIONS[world.region].tools : []);
	const lay = $derived(world.region ? fieldLayout(world.region, world.seed) : null);
	const stars = $derived(
		world.region ? world.stars[world.region] : Object.values(world.stars).reduce((a, b) => a + b, 0)
	);

	function save() {
		writeOpSave(typeof localStorage === 'undefined' ? null : localStorage, world);
	}

	function paint(canvas: HTMLCanvasElement | null = canvasEl) {
		const root = stageEl;
		if (root) {
			root.dataset.view = world.view;
			root.dataset.phase = world.phase;
			root.dataset.tool = world.tool;
			root.dataset.bleed = String(Math.round(world.bleed));
			root.dataset.complete = world.complete ? '1' : '0';
			root.dataset.region = world.region ?? '';
			root.dataset.stars = String(stars);
			root.dataset.seed = String(world.seed);
			root.dataset.audio = audioOn ? '1' : '0';
			root.dataset.spray = String(Math.round(world.spray));
			root.dataset.reduced = world.reducedMotion ? '1' : '0';
			root.dataset.paused = world.paused ? '1' : '0';
			root.dataset.ack = world.graphicAck ? '1' : '0';
			root.dataset.progress = String(Math.round(world.progress * 100));
			root.dataset.stones = String(world.stoneCount);
			root.dataset.stone = String(world.stoneIndex);
			if (lay) {
				root.dataset.targetX = String(Math.round(lay.target.x * 1000) / 1000);
				root.dataset.targetY = String(Math.round(lay.target.y * 1000) / 1000);
			}
		}
		if (!canvas) return;
		canvas.dataset.play = 'operation';
		canvas.dataset.view = world.view;
		canvas.dataset.phase = world.phase;
		canvas.dataset.tool = world.tool;
		canvas.dataset.bleed = String(Math.round(world.bleed));
		canvas.dataset.complete = world.complete ? '1' : '0';
		canvas.dataset.graphic = world.view === 'field' ? '1' : '0';
		canvas.dataset.ready = scene ? '1' : '0';
		canvas.dataset.paused = world.paused ? '1' : '0';
		canvas.dataset.reduced = world.reducedMotion ? '1' : '0';
		canvas.dataset.spray = String(world.sprayCap === 0 ? 0 : Math.round(world.spray));
	}

	let holdTick = 0;

	function uvFrom(event: PointerEvent) {
		const el = canvasEl ?? stageEl;
		if (!el) return { x: 0.5, y: 0.5 };
		const b = el.getBoundingClientRect();
		return {
			x: Math.min(1, Math.max(0, (event.clientX - b.left) / Math.max(1, b.width))),
			y: Math.min(1, Math.max(0, (event.clientY - b.top) / Math.max(1, b.height)))
		};
	}

	function capture(event: PointerEvent) {
		try {
			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		} catch {
			/* Playwright synthetic pointers */
		}
	}

	function stopHoldTick() {
		if (holdTick) {
			clearInterval(holdTick);
			holdTick = 0;
		}
	}

	function startHoldTick() {
		stopHoldTick();
		holdTick = window.setInterval(() => {
			if (world.view === 'field' && world.pointerDown && !world.paused) {
				stepOp(world, 0.05);
				scene?.sync(world);
				paint();
			}
		}, 50);
	}

	function onFieldPointer(event: PointerEvent, phase: 'down' | 'move' | 'up') {
		if (world.view !== 'field') return;
		if (event.cancelable) event.preventDefault();
		const { x, y } = uvFrom(event);
		if (phase === 'down') {
			capture(event);
			pointerDown(world, x, y);
			startHoldTick();
			if (world.audioWanted && audioOn) {
				if (world.tool === 'scalpel') tickOpTool('cut');
				else if (world.tool === 'suction' || world.tool === 'irrigator') tickOpTool('wet');
				else if (world.tool === 'gauze' || world.tool === 'bandage') tickOpTool('pack');
				else tickOpTool('metal');
			}
		} else if (phase === 'move') {
			pointerMove(world, x, y);
			stepOp(world, 0.05);
		} else {
			pointerUp(world);
			stopHoldTick();
		}
		paint();
	}

	function acknowledge() {
		ackGraphic(world);
		save();
	}

	function enterRegion(id: RegionId) {
		pickRegion(world, id);
		save();
		paint();
	}

	function backHub() {
		leaveField(world);
		save();
		paint();
	}

	function chooseTool(id: ToolId) {
		setOpTool(world, id);
		lastTool = id;
		paint();
	}

	function togglePause() {
		setPaused(world, !world.paused);
		paint();
	}

	async function toggleAudio() {
		if (!audioOn) {
			const ok = await unlockOpAudio();
			if (!ok) return;
			audioOn = true;
			world.audioWanted = true;
			setOpMuted(false);
		} else {
			audioOn = false;
			world.audioWanted = false;
			setOpMuted(true);
		}
		save();
		paint();
	}

	function toggleSpray() {
		world.lessSpray = !world.lessSpray;
		save();
		paint();
	}

	function toggleDetail() {
		world.lowDetail = !world.lowDetail;
		save();
		scene?.resize();
		paint();
	}

	function onReplay() {
		replayRegion(world);
		save();
		paint();
	}

	function onReseed() {
		reseedRegion(world);
		save();
		paint();
	}

	let booting = false;

	function bootScene() {
		if (scene || booting || !canvasEl || !stageEl || !world.graphicAck) return;
		booting = true;
		const canvas = canvasEl;
		const stage = stageEl;
		void (async () => {
			const { mountOpScene } = await import('./render');
			scene = mountOpScene(canvas);
			if (!scene) {
				sceneFailed = true;
				return;
			}
			scene.resize();
			scene.sync(world);
			canvas.dataset.ready = '1';
			paint(canvas);
			const loop = (now: number) => {
				const dt = Math.min(0.05, (now - last) / 1000);
				last = now;
				if (world.view === 'field' && !world.paused && !document.hidden) {
					stepOp(world, dt);
					if (world.tool !== lastTool) lastTool = world.tool;
				}
				scene?.sync(world);
				scene?.render(now);
				paint(canvas);
				raf = requestAnimationFrame(loop);
			};
			raf = requestAnimationFrame(loop);
		})();
		const ro = new ResizeObserver(() => scene?.resize());
		ro.observe(stage);
		stageEl && ((stageEl as HTMLDivElement & { _ro?: ResizeObserver })._ro = ro);
	}

	$effect(() => {
		if (world.graphicAck && canvasEl && stageEl) bootScene();
	});

	onMount(() => {
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		const applyMotion = () => {
			world.reducedMotion = motion.matches;
			world.sprayCap = world.reducedMotion ? 0 : world.lessSpray || world.lowDetail ? 20 : 80;
			if (world.sprayCap === 0) world.spray = 0;
			paint();
		};
		applyMotion();
		motion.addEventListener('change', applyMotion);
		paint();
		const onVis = () => {
			if (document.hidden) {
				world.pointerDown = false;
				paint();
			}
		};
		document.addEventListener('visibilitychange', onVis);
		window.addEventListener('pagehide', save);
		const interval = setInterval(save, 4000);
		return () => {
			stopHoldTick();
			cancelAnimationFrame(raf);
			clearInterval(interval);
			motion.removeEventListener('change', applyMotion);
			document.removeEventListener('visibilitychange', onVis);
			window.removeEventListener('pagehide', save);
			scene?.dispose();
			stopOpAudio();
			save();
		};
	});
</script>

<svelte:head>
	<title>轻心 · {title}</title>
</svelte:head>

<div
	class="op-play"
	data-play="operation"
	data-view={world.view}
	data-phase={world.phase}
	data-tool={world.tool}
	data-bleed={Math.round(world.bleed)}
	data-complete={world.phase === 'done' || world.complete ? '1' : '0'}
	data-ack={world.graphicAck ? '1' : '0'}
	data-region={world.region ?? ''}
	data-paused={world.paused ? '1' : '0'}
	data-reduced={world.reducedMotion ? '1' : '0'}
	data-progress={Math.round(world.progress * 100)}
	data-down={world.pointerDown ? '1' : '0'}
	data-spray={world.reducedMotion ? 0 : Math.round(world.spray)}
	data-stars={stars}
	data-seed={world.seed}
	data-target-x={lay ? Math.round(lay.target.x * 1000) / 1000 : 0.5}
	data-target-y={lay ? Math.round(lay.target.y * 1000) / 1000 : 0.5}
	data-stones={world.stoneCount}
>
	<header class="top" data-hud="top">
		<a href="/modules/games" class="{LINK_CLASS} hud-back" data-hud="back">← 返回目录</a>
		<h1 class="sr-only">{title}</h1>
		<p class="mark" data-hud="mark">含血腥 · 虚构娱乐，不是医疗训练</p>
		<div class="top-actions" data-hud="actions">
			{#if world.view === 'field'}
				<Button variant="secondary" class="hud-btn" onclick={togglePause}>
					{world.paused ? '继续' : '暂停'}
				</Button>
				<Button variant="secondary" class="hud-btn" onclick={backHub}>身体图</Button>
			{/if}
		</div>
	</header>

	{#if world.view === 'warning'}
		<section class="warn" data-view="warning" aria-labelledby="op-warn-title">
			<h2 id="op-warn-title">手术</h2>
			<p class="warn-copy">{WARNING_COPY}</p>
			<ul class="warn-list">
				<li>四个可做区域：前臂、膝、口腔、腹。其他部位尚未开放。</li>
				<li>画面含伤口、组织与血液。直接进入或刷新都会先看到本警告。</li>
				<li>请用器械在术野里操作，不是答题。</li>
			</ul>
			<Button class="ack" onclick={acknowledge}>{ACK_LABEL}</Button>
		</section>
	{:else}
		<div
			bind:this={stageEl}
			class="stage"
			class:field={world.view === 'field'}
			tabindex="-1"
			data-stage="1"
		>
			<canvas
				bind:this={canvasEl}
				class="h-full w-full"
				data-play="operation"
				data-graphic={world.view === 'field' ? '1' : '0'}
				aria-label={world.view === 'hub' ? '身体总览' : '手术术野'}
				style="touch-action: none"
			></canvas>
			<div
				class="hit"
				data-hit="1"
				aria-hidden="true"
				onpointerdown={(e) => onFieldPointer(e, 'down')}
				onpointermove={(e) => onFieldPointer(e, 'move')}
				onpointerup={(e) => onFieldPointer(e, 'up')}
			></div>
			{#if sceneFailed}
				<p class="fail">这台设备画不出术野。仍可用按钮选择区域与器械。</p>
			{/if}
			{#if world.view === 'hub'}
				<div class="hub-panel" data-hud="hub">
					<p class="hub-lead">选择开放区域。胸、脊、眼尚未制作。</p>
					<div class="regions">
						{#each regionList as region (region.id)}
							<button
								type="button"
								class="region"
								data-region={region.id}
								onclick={() => enterRegion(region.id)}
							>
								<span class="rn">{region.name}</span>
								<span class="rs">{world.stars[region.id] ? `${world.stars[region.id]}★` : '未做'}</span>
							</button>
						{/each}
					</div>
					<div class="locked">
						{#each LOCKED_PARTS as part (part.id)}
							<span class="lock" data-locked={part.id}>{part.name} 未开放</span>
						{/each}
					</div>
				</div>
			{:else if world.region}
				<div class="field-hud" data-hud="field">
					<ol class="phases" data-hud="phases">
						{#each PHASES as phase}
							<li
								class:on={world.phase === phase}
								class:done={PHASES.indexOf(world.phase as (typeof PHASES)[number]) >
									PHASES.indexOf(phase) || world.phase === 'done'}
							>
								{PHASE_LABEL[phase]}
							</li>
						{/each}
					</ol>
					<p class="notice" data-hud="notice">{world.notice}</p>
					<div class="tray" data-hud="tray">
						{#each kit as tool (tool)}
							<button
								type="button"
								class="chip"
								class:on={world.tool === tool}
								class:need={legalTools(world).includes(tool)}
								data-tool={tool}
								onclick={() => chooseTool(tool)}
							>
								{TOOL_LABEL[tool]}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>
		<footer class="dock" class:thin={world.dockCollapsed} data-hud="dock">
			<div class="dock-row" data-hud="toggles">
				<Button variant="secondary" class="hud-btn" onclick={toggleAudio}>
					{audioOn ? '器械声开' : '器械声'}
				</Button>
				<Button variant="secondary" class="hud-btn" onclick={toggleSpray}>
					{world.lessSpray ? '少喷溅' : '喷溅'}
				</Button>
				<Button variant="secondary" class="hud-btn" onclick={toggleDetail}>
					{world.lowDetail ? '低细腻' : '细腻'}
				</Button>
				{#if world.complete}
					<Button variant="secondary" class="hud-btn" onclick={onReplay}>再做一次</Button>
					<Button variant="secondary" class="hud-btn" onclick={onReseed}>换种子</Button>
				{/if}
			</div>
			<p class="hint" data-hud="hint">
				{#if world.view === 'hub'}
					四个可做部位。其余未开放。
				{:else}
					{PHASE_LABEL[world.phase]} · 出血 {Math.round(world.bleed)} · 种子 {world.seed}
					{#if world.complete} · 完成 {stars}★{/if}
				{/if}
			</p>
		</footer>
	{/if}
</div>

<style>
	.op-play {
		position: relative;
		display: grid;
		grid-template-rows: auto 1fr auto;
		min-height: 100dvh;
		background: #14181c;
		color: #f4efe8;
	}

	.top,
	.dock,
	.hub-panel {
		background: rgb(16 20 22 / 0.94);
		color: #f4efe8;
		border-color: rgb(255 255 255 / 0.08);
	}

	.top {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.45rem 0.75rem;
		align-items: center;
		padding: 0.45rem 0.7rem;
		z-index: 3;
	}

	.mark {
		margin: 0;
		font-size: 0.78rem;
		letter-spacing: 0.02em;
		color: #ffc9c0;
	}

	.op-play :global(.hud-back) {
		color: #93c5fd;
	}

	.top-actions {
		display: flex;
		gap: 0.35rem;
	}

	:global(.op-play .hud-btn) {
		min-height: 44px;
		padding-inline: 0.85rem;
		font-size: 0.9rem;
	}

	.warn {
		margin: 8vh auto;
		max-width: 36rem;
		padding: 1.25rem 1.1rem 1.5rem;
		border-radius: 1.1rem;
		background: color-mix(in srgb, #1b2422 86%, #0b0d0c);
		box-shadow: 0 24px 60px -28px rgb(0 0 0 / 0.7);
	}

	.warn h2 {
		margin: 0 0 0.7rem;
		font-size: 1.45rem;
	}

	.warn-copy {
		margin: 0 0 0.8rem;
		line-height: 1.55;
		overflow: auto;
		max-height: 40vh;
	}

	.warn-list {
		margin: 0 0 1rem;
		padding-left: 1.1rem;
		line-height: 1.5;
		color: #d7ddd8;
	}

	:global(.op-play .ack) {
		width: 100%;
		min-height: 44px;
	}

	.stage {
		position: relative;
		min-height: 0;
		overflow: hidden;
		touch-action: none;
	}

	.hit {
		position: absolute;
		inset: 0;
		z-index: 1;
		touch-action: none;
	}

	.hub-panel {
		position: absolute;
		left: 0.7rem;
		right: 0.7rem;
		bottom: 0.7rem;
		padding: 0.7rem 0.8rem;
		z-index: 3;
	}

	.hub-lead {
		margin: 0 0 0.45rem;
		font-size: 0.9rem;
	}

	.regions {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.4rem;
	}

	.region {
		min-height: 44px;
		border-radius: 0.75rem;
		border: 1px solid color-mix(in srgb, white 18%, transparent);
		background: color-mix(in srgb, #1f3d34 70%, black);
		color: inherit;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.1rem;
	}

	.rn {
		font-weight: 650;
	}

	.rs {
		font-size: 0.75rem;
		opacity: 0.8;
	}

	.locked {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 0.45rem;
	}

	.lock {
		font-size: 0.75rem;
		opacity: 0.7;
		padding: 0.15rem 0.4rem;
		border-radius: 999px;
		border: 1px dashed color-mix(in srgb, white 25%, transparent);
	}

	.field-hud {
		position: absolute;
		left: 0.55rem;
		right: 0.55rem;
		bottom: 0.45rem;
		z-index: 3;
		display: grid;
		gap: 0.35rem;
		pointer-events: none;
	}

	.phases {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.phases li {
		font-size: 0.72rem;
		padding: 0.15rem 0.4rem;
		border-radius: 999px;
		background: rgb(15 23 42 / 0.45);
	}

	.phases li.on {
		background: #b91c1c;
	}

	.phases li.done {
		background: #166534;
	}

	.notice {
		margin: 0;
		font-size: 0.85rem;
		background: rgb(15 18 20 / 0.55);
		padding: 0.35rem 0.5rem;
		border-radius: 0.5rem;
	}

	.tray {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		pointer-events: auto;
	}

	.chip {
		min-height: 44px;
		min-width: 44px;
		padding: 0 0.75rem;
		border-radius: 0.75rem;
		border: 1px solid color-mix(in srgb, white 20%, transparent);
		background: rgb(20 24 28 / 0.72);
		color: inherit;
	}

	.chip.need {
		outline: 2px solid #f8d0c8;
	}

	.chip.on {
		background: #9f1239;
	}

	.dock {
		padding: 0.4rem 0.7rem 0.55rem;
		z-index: 3;
	}

	.warn {
		color: #f4efe8;
	}

	.dock-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.hint {
		margin: 0.3rem 0 0;
		font-size: 0.8rem;
		opacity: 0.85;
	}

	.fail {
		position: absolute;
		inset: auto 1rem 1rem;
		z-index: 2;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}

	@media (max-width: 420px) {
		.top {
			grid-template-columns: 1fr auto;
			grid-template-areas:
				'back actions'
				'mark mark';
		}

		.hud-back {
			grid-area: back;
		}

		.mark {
			grid-area: mark;
		}

		.top-actions {
			grid-area: actions;
		}

		.regions {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.hub-panel {
			left: 0.4rem;
			right: 0.4rem;
		}
	}
</style>

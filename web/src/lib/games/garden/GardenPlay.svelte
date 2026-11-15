<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import PlantView from './PlantView.svelte';
	import { readGardenSave, writeGardenSave } from './persist';
	import { PLANTS, plantById } from './plants';
	import type { GardenScene } from './render';
	import {
		BED_COUNT,
		buyFertilizer,
		buySeed,
		catchBug,
		clearWilt,
		emergencyKit,
		feedBed,
		growthBlock,
		harvestBed,
		isDeadlocked,
		plantSeed,
		pruneBed,
		refillWater,
		repotBed,
		restartGarden,
		roleFor,
		stepGarden,
		tickGarden,
		toggleShade,
		waterBed,
		type BugKind,
		type GardenState
	} from './sim';

	let { title }: { title: string } = $props();

	let garden = $state<GardenState>(readGardenSave());
	let selected = $state(0);
	let pickSeed = $state('tomato');
	let shopOpen = $state(false);
	let sceneFailed = $state(false);
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let stageEl = $state<HTMLDivElement | null>(null);

	const bed = $derived(garden.beds[selected]);
	const def = $derived(bed?.plantId ? plantById(bed.plantId) : undefined);
	const deadlocked = $derived(isDeadlocked(garden));
	const visiting = $derived(
		garden.bugs.filter((bug) => bug.bedId === selected && bug.phase !== 'leave')
	);
	const block = $derived(bed ? growthBlock(bed) : null);

	const bugName: Record<BugKind, string> = {
		aphid: '蚜虫',
		snail: '蜗牛',
		bee: '蜜蜂',
		ladybug: '瓢虫',
		butterfly: '蝴蝶',
		caterpillar: '毛虫'
	};

	const stageName: Record<string, string> = {
		empty: '空着',
		seed: '种子',
		sprout: '嫩芽',
		leaf: '展叶',
		bud: '花蕾',
		bloom: '开花',
		ripe: '可收获',
		wilt: '枯了'
	};

	const primary: 'plant' | 'harvest' | 'clear' | 'water' | 'feed' = $derived.by(() => {
		if (!bed || bed.stage === 'empty') return 'plant';
		if (bed.stage === 'ripe') return 'harvest';
		if (bed.stage === 'wilt') return 'clear';
		if (block === '渴了') return 'water';
		if (block === '饿了') return 'feed';
		return 'water';
	});

	function save() {
		writeGardenSave(garden);
	}

	function paintCanvas() {
		const canvas = canvasEl;
		if (!canvas) return;
		canvas.dataset.stages = garden.beds.map((item) => item.stage).join(',');
		canvas.dataset.plants = garden.beds.map((item) => item.plantId ?? '').join(',');
		canvas.dataset.selected = String(selected);
	}

	function plantSelected() {
		plantSeed(garden, selected, pickSeed);
		save();
	}

	function doWater() {
		waterBed(garden, selected);
		save();
	}

	function doFeed() {
		feedBed(garden, selected);
		save();
	}

	function doShade() {
		toggleShade(garden, selected);
		save();
	}

	function doPrune() {
		pruneBed(garden, selected);
		save();
	}

	function doRepot() {
		repotBed(garden, selected);
		save();
	}

	function doHarvest() {
		harvestBed(garden, selected);
		save();
	}

	function doClear() {
		clearWilt(garden, selected);
		save();
	}

	function doCatch(bugId: number) {
		catchBug(garden, selected, bugId);
		save();
	}

	function doBuy(id: string) {
		buySeed(garden, id);
		pickSeed = id;
		save();
	}

	function doRefill() {
		refillWater(garden);
		save();
	}

	function doFert() {
		buyFertilizer(garden);
		save();
	}

	function doKit() {
		emergencyKit(garden);
		save();
	}

	function togglePause() {
		garden.paused = !garden.paused;
	}

	function restart() {
		restartGarden(garden, Date.now());
		selected = 0;
		save();
	}

	function onKey(event: KeyboardEvent) {
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
			return;
		if (event.key === 'ArrowRight') selected = (selected + 1) % BED_COUNT;
		if (event.key === 'ArrowLeft') selected = (selected + (BED_COUNT - 1)) % BED_COUNT;
		if (event.key === 'ArrowDown') selected = (selected + 4) % BED_COUNT;
		if (event.key === 'ArrowUp') selected = (selected + 8) % BED_COUNT;
		if (/^[1-9]$/.test(event.key)) selected = Number(event.key) - 1;
		if (event.key === '0') selected = 9;
		if (event.key === '-' || event.key === '_') selected = 10;
		if (event.key === '=' || event.key === '+') selected = 11;
		if (event.key === 'w' || event.key === 'W') doWater();
		if (event.key === 'f' || event.key === 'F') doFeed();
		if (event.key === 'p' || event.key === 'P') doPrune();
		if (event.key === 't' || event.key === 'T') doRepot();
		if (event.key === 'h' || event.key === 'H') doHarvest();
	}

	onMount(() => {
		garden = readGardenSave();
		if (!plantById(pickSeed)) pickSeed = 'tomato';
		let scene: GardenScene | null = null;
		let raf = 0;
		let last = performance.now();
		const canvas = canvasEl;
		const stage = stageEl;
		let resizeObserver: ResizeObserver | undefined;
		let cancelled = false;
		let onDown: ((event: PointerEvent) => void) | undefined;

		void (async () => {
			const { mountGardenScene } = await import('./render');
			if (cancelled || !canvas || !stage) return;
			scene = mountGardenScene(canvas);
			if (!scene) {
				sceneFailed = true;
				return;
			}
			scene.resize();
			canvas.dataset.ready = '1';
			paintCanvas();
			resizeObserver = new ResizeObserver(() => scene?.resize());
			resizeObserver.observe(stage);
			onDown = (event: PointerEvent) => {
				const id = scene?.pick(event.clientX, event.clientY);
				if (id != null) selected = id;
			};
			stage.addEventListener('pointerup', onDown);
			const loop = (now: number) => {
				const dt = Math.min(250, now - last);
				last = now;
				if (!garden.paused && !document.hidden) stepGarden(garden, dt);
				scene?.sync(garden, selected);
				scene?.render(now);
				paintCanvas();
				raf = requestAnimationFrame(loop);
			};
			raf = requestAnimationFrame(loop);
		})();

		if (typeof window !== 'undefined' && (window as { __qingxinE2E?: boolean }).__qingxinE2E) {
			(
				window as {
					__qingxinGardenTest?: {
						tick: (n: number) => void;
						potClient: (id: number) => { x: number; y: number } | null;
						snapshot: () => {
							selected: number;
							paused: boolean;
							beds: Array<{ id: number; plantId: string | null; stage: string }>;
						};
						spawnPest: (bedId: number) => void;
						select: (id: number) => void;
						setPaused: (paused: boolean) => void;
					};
				}
			).__qingxinGardenTest = {
				tick(n: number) {
					const paused = garden.paused;
					garden.paused = false;
					for (let i = 0; i < n; i++) tickGarden(garden);
					garden.paused = paused;
					save();
					paintCanvas();
				},
				potClient(id: number) {
					return scene?.projectPot(id) ?? null;
				},
				snapshot() {
					return {
						selected,
						paused: garden.paused,
						beds: garden.beds.map((item) => ({
							id: item.id,
							plantId: item.plantId,
							stage: item.stage
						}))
					};
				},
				spawnPest(bedId: number) {
					const host = garden.beds[bedId];
					if (!host) return;
					const bug = {
						id: garden.nextId++,
						kind: 'aphid' as const,
						role: roleFor('aphid'),
						bedId,
						phase: 'visit' as const,
						age: 6,
						ttl: 90
					};
					garden.bugs.push(bug);
					host.bugs = [...host.bugs, bug];
					save();
				},
				select(id: number) {
					if (id >= 0 && id < BED_COUNT) selected = id;
				},
				setPaused(paused: boolean) {
					garden.paused = paused;
				}
			};
		}

		const onVis = () => {
			if (document.hidden) garden.paused = true;
		};
		const onHide = () => save();
		document.addEventListener('visibilitychange', onVis);
		window.addEventListener('pagehide', onHide);
		window.addEventListener('keydown', onKey);
		const interval = setInterval(save, 4000);
		return () => {
			cancelled = true;
			cancelAnimationFrame(raf);
			clearInterval(interval);
			resizeObserver?.disconnect();
			if (onDown && stage) stage.removeEventListener('pointerup', onDown);
			document.removeEventListener('visibilitychange', onVis);
			window.removeEventListener('pagehide', onHide);
			window.removeEventListener('keydown', onKey);
			scene?.dispose();
			save();
		};
	});
</script>

<svelte:head>
	<title>轻心 · {title}</title>
</svelte:head>

<div class="garden-play">
	<header class="top qx-glass">
		<a href="/modules/games" class="{LINK_CLASS} shrink-0">← 返回目录</a>
		<h1 class="sr-only">{title}</h1>
		<ul class="stats" aria-label="园子资源">
			<li><b>{garden.coins}</b><span>收成币</span></li>
			<li><b>{garden.waterCan}</b><span>清水</span></li>
			<li><b>{garden.fertilizer}</b><span>肥料</span></li>
		</ul>
		<div class="top-actions">
			<Button variant="secondary" class="px-4" onclick={togglePause}>
				{garden.paused ? '继续' : '暂停'}
			</Button>
			<Button variant="secondary" class="px-4" onclick={restart}>重新开始</Button>
		</div>
	</header>

	<div bind:this={stageEl} class="stage" data-play="garden">
		<canvas bind:this={canvasEl} class="h-full w-full" aria-label="窗前庭园"></canvas>
		{#if sceneFailed}
			<p class="fail">这台设备画不出窗台。用键盘左右键选盆，再照料。</p>
		{/if}
		<nav class="bed-nav" aria-label="花盆">
			{#each garden.beds as plot (plot.id)}
				<button
					type="button"
					class="bed-hit"
					data-bed={plot.id}
					aria-pressed={selected === plot.id}
					aria-label="盆 {plot.id + 1} {plot.plantId
						? plantById(plot.plantId)?.name
						: '空着'} {stageName[plot.stage]}"
					onclick={() => (selected = plot.id)}
				>
					{plot.id + 1}
				</button>
			{/each}
		</nav>
	</div>

	<section class="dock qx-glass" aria-label="照料" data-garden-dock>
		<p class="notice" aria-live="polite">{garden.notice}</p>
		<p class="need">
			{#if def && bed}
				{def.name} · {stageName[bed.stage]}
				{#if block}<strong>{block}</strong>{/if}
			{:else}
				点窗台上的花盆，再选种子。
			{/if}
		</p>

		{#if visiting.length}
			<div class="bugs">
				{#each visiting as bug (bug.id)}
					<button type="button" class="bug {bug.role}" onclick={() => doCatch(bug.id)}>
						{bug.role === 'pest' ? '捉走' : '留下'}{bugName[bug.kind]}
						<span>{bug.role === 'pest' ? '害虫' : '益虫'}</span>
					</button>
				{/each}
			</div>
		{/if}

		<div class="seeds" data-seed-browser>
			{#each PLANTS as plant (plant.id)}
				<button
					type="button"
					class="seed {pickSeed === plant.id ? 'on' : ''}"
					aria-label={plant.name}
					onclick={() => (pickSeed = plant.id)}
				>
					<PlantView plantId={plant.id} stage="bloom" compact />
					<span>{plant.name}</span>
					<span class="meta">{garden.seeds[plant.id] ?? 0} 粒</span>
				</button>
			{/each}
		</div>

		{#if shopOpen}
			<div class="buys">
				{#each PLANTS as plant (plant.id)}
					<button type="button" class="buy" onclick={() => doBuy(plant.id)}>
						买{plant.name}
						{plant.seedCost}
					</button>
				{/each}
				<button type="button" class="buy" onclick={doRefill}>加水 5</button>
				<button type="button" class="buy" onclick={doFert}>买肥 4</button>
			</div>
		{/if}

		{#if deadlocked}
			<div class="mt-2">
				<Button onclick={doKit}>空园补给</Button>
			</div>
		{/if}

		<div class="actions">
			<Button
				class="min-h-12 min-w-20 px-5"
				variant={primary === 'plant' ? 'primary' : 'secondary'}
				onclick={plantSelected}
			>
				种下{plantById(pickSeed)?.name ?? ''}
			</Button>
			<Button
				class="min-h-12 min-w-20 px-5"
				variant={primary === 'water' ? 'primary' : 'secondary'}
				onclick={doWater}>浇水</Button
			>
			<Button
				class="min-h-12 min-w-20 px-5"
				variant={primary === 'feed' ? 'primary' : 'secondary'}
				onclick={doFeed}>施肥</Button
			>
			<Button
				class="min-h-12 min-w-20 px-5"
				variant={primary === 'harvest' ? 'primary' : 'secondary'}
				onclick={doHarvest}
				disabled={bed?.stage !== 'ripe'}>收获</Button
			>
			<Button class="min-h-12 min-w-20 px-5" variant="secondary" onclick={doPrune}>修剪</Button>
			<Button class="min-h-12 min-w-20 px-5" variant="secondary" onclick={doRepot}>换盆</Button>
			<Button class="min-h-12 min-w-20 px-5" variant="secondary" onclick={doShade}>遮荫</Button>
			<Button
				class="min-h-12 min-w-20 px-5"
				variant={primary === 'clear' ? 'primary' : 'secondary'}
				onclick={doClear}
				disabled={bed?.stage !== 'wilt'}>清空</Button
			>
			<Button class="min-h-12 px-5" variant="secondary" onclick={() => (shopOpen = !shopOpen)}>
				{shopOpen ? '收起购买' : '买种子'}
			</Button>
		</div>
	</section>

</div>

<style>
	.garden-play {
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
		gap: 0.7rem;
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

	.bed-nav {
		position: absolute;
		left: 0.4rem;
		top: 0.4rem;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		max-height: calc(100% - 0.8rem);
		overflow: auto;
		opacity: 0;
		pointer-events: none;
		z-index: 4;
	}

	.bed-nav:focus-within {
		opacity: 1;
		pointer-events: auto;
	}

	.bed-hit {
		min-height: 2.75rem;
		min-width: 2.75rem;
		border-radius: 0.8rem;
		background: color-mix(in oklab, var(--qx-card) 82%, transparent);
		font-weight: 600;
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
		margin: 0.2rem 0 0;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.need strong {
		margin-left: 0.4rem;
		color: var(--qx-accent-coral);
	}

	.bugs,
	.seeds,
	.actions,
	.buys {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.5rem;
	}

	.seeds {
		flex-wrap: nowrap;
		overflow-x: auto;
		padding-bottom: 0.1rem;
	}

	.seed,
	.buy,
	.bug {
		min-height: 2.75rem;
		border-radius: 0.9rem;
		padding: 0.3rem 0.5rem;
		background: color-mix(in oklab, var(--qx-surface) 70%, transparent);
		border: 1px solid color-mix(in oklab, white 28%, var(--qx-line));
	}

	.seed {
		text-align: center;
		font-size: 0.75rem;
		min-width: 4.2rem;
	}

	.seed.on {
		box-shadow: inset 0 0 0 2px var(--qx-primary);
	}

	.seed .meta,
	.bug span {
		display: block;
		color: var(--qx-muted);
		font-weight: 500;
	}

	.bug {
		min-width: 6.5rem;
		font-weight: 600;
	}

	.bug.pest {
		background: color-mix(in oklab, var(--qx-accent-coral) 22%, var(--qx-card));
	}

	.bug.pollinator,
	.bug.predator {
		background: color-mix(in oklab, var(--qx-accent-teal) 22%, var(--qx-card));
	}

	.actions {
		margin-top: 0.55rem;
	}

	.seed:focus-visible,
	.buy:focus-visible,
	.bug:focus-visible,
	.bed-hit:focus-visible {
		outline: 2px solid var(--qx-primary);
		outline-offset: 2px;
	}

	@media (max-width: 430px) {
		.top-actions :global(button) {
			min-width: 0;
			padding-inline: 0.7rem;
		}
	}

	@media (min-width: 768px) {
		.seeds {
			flex-wrap: wrap;
			overflow: visible;
		}
	}
</style>

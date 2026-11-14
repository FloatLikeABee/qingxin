<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import PlantView from './PlantView.svelte';
	import { FAMILY_LABEL, MORPH_FAMILIES, type MorphFamily } from './morph';
	import { readGardenSave, writeGardenSave } from './persist';
	import { PLANTS, plantById, unlockedPlants, type Need } from './plants';
	import type { GardenScene } from './render';
	import {
		buyFertilizer,
		buySeed,
		catchBug,
		clearWilt,
		emergencyKit,
		feedBed,
		harvestBed,
		isDeadlocked,
		plantSeed,
		pruneBed,
		refillWater,
		repotBed,
		restartGarden,
		seedGardenDemo,
		stepGarden,
		toggleShade,
		waterBed,
		type BugKind,
		type GardenState
	} from './sim';

	let { title }: { title: string } = $props();

	let garden = $state<GardenState>(readGardenSave());
	let selected = $state(0);
	let pickSeed = $state('tomato');
	let familyFilter = $state<'all' | MorphFamily>('all');
	let shopOpen = $state(false);
	let sceneFailed = $state(false);
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let stageEl = $state<HTMLDivElement | null>(null);

	const bed = $derived(garden.beds[selected]);
	const def = $derived(bed?.plantId ? plantById(bed.plantId) : undefined);
	const nursery = $derived(
		unlockedPlants(garden.harvests).filter(
			(plant) => familyFilter === 'all' || plant.morph.family === familyFilter
		)
	);
	const deadlocked = $derived(isDeadlocked(garden));
	const visiting = $derived(
		garden.bugs.filter((bug) => bug.bedId === selected && bug.phase !== 'leave')
	);
	const ownedSeeds = $derived(
		unlockedPlants(garden.harvests).filter(
			(plant) => (garden.seeds[plant.id] ?? 0) > 0 || plant.unlockAt === 0
		)
	);

	const bugName: Record<BugKind, string> = {
		aphid: '蚜虫',
		snail: '蜗牛',
		bee: '蜜蜂',
		ladybug: '瓢虫',
		butterfly: '蝴蝶',
		caterpillar: '毛虫'
	};

	const stageName: Record<string, string> = {
		empty: '空盆',
		seed: '种子',
		sprout: '嫩芽',
		leaf: '展叶',
		bud: '花蕾',
		bloom: '开花',
		ripe: '可收获',
		wilt: '枯了'
	};

	const needZh: Record<Need, string> = { low: '少', mid: '中', high: '多' };

	function needOf(need: Need) {
		if (need === 'low') return 1;
		if (need === 'high') return 3;
		return 2;
	}

	const thirsty = $derived(Boolean(def && bed && bed.water < needOf(def.water)));
	const hungry = $derived(Boolean(def && bed && bed.nutrient < needOf(def.nutrient)));
	const primary: 'plant' | 'harvest' | 'clear' | 'water' | 'feed' = $derived.by(() => {
		if (!bed || bed.stage === 'empty') return 'plant';
		if (bed.stage === 'ripe') return 'harvest';
		if (bed.stage === 'wilt') return 'clear';
		if (thirsty) return 'water';
		if (hungry) return 'feed';
		return 'water';
	});

	function save() {
		writeGardenSave(garden);
	}

	function chooseBed(id: number) {
		selected = id;
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
		if (event.target instanceof HTMLInputElement) return;
		if (event.key === 'ArrowRight') selected = (selected + 1) % 12;
		if (event.key === 'ArrowLeft') selected = (selected + 11) % 12;
		if (event.key === 'ArrowDown') selected = (selected + 4) % 12;
		if (event.key === 'ArrowUp') selected = (selected + 8) % 12;
		if (/^[1-9]$/.test(event.key)) selected = Number(event.key) - 1;
		if (event.key === '0') selected = 9;
		if (event.key === 'w' || event.key === 'W') doWater();
		if (event.key === 'f' || event.key === 'F') doFeed();
		if (event.key === 'p' || event.key === 'P') doPrune();
		if (event.key === 't' || event.key === 'T') doRepot();
		if (event.key === 'h' || event.key === 'H') doHarvest();
	}

	onMount(() => {
		garden = readGardenSave();
		if (!unlockedPlants(garden.harvests).some((plant) => plant.id === pickSeed)) {
			pickSeed = 'tomato';
		}
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
				raf = requestAnimationFrame(loop);
			};
			raf = requestAnimationFrame(loop);
		})();

		if (typeof window !== 'undefined' && (window as { __qingxinE2E?: boolean }).__qingxinE2E) {
			(window as { __qingxinGardenTest?: { seedDemo: () => void } }).__qingxinGardenTest = {
				seedDemo() {
					seedGardenDemo(garden);
					save();
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

<div class="garden-play relative h-dvh min-h-0 w-full overflow-hidden bg-[var(--qx-bg)]">
	<div bind:this={stageEl} class="absolute inset-0 touch-none" data-play="garden">
		<canvas bind:this={canvasEl} class="h-full w-full" aria-label="窗前庭园"></canvas>
		{#if sceneFailed}
			<p class="fail">这台设备画不出窗台。下面的盆仍可点选照料。</p>
		{/if}
	</div>

	<header
		class="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-3 pt-[max(0.55rem,env(safe-area-inset-top))] md:px-5"
	>
		<a href="/modules/games" class="{LINK_CLASS} chip-bg pointer-events-auto shrink-0">← 返回目录</a
		>
		<h1 class="sr-only">{title}</h1>
		<div class="pointer-events-auto ml-auto flex gap-2">
			<Button variant="secondary" class="px-4" onclick={togglePause}>
				{garden.paused ? '继续' : '暂停'}
			</Button>
			<Button variant="secondary" class="px-4" onclick={restart}>重新开始</Button>
		</div>
	</header>

	<ul
		class="pointer-events-none absolute inset-x-0 top-14 z-10 mx-auto grid w-full max-w-3xl grid-cols-3 gap-2 px-3 md:top-16 md:px-5"
	>
		<li class="stat">{garden.coins} <span>收成币</span></li>
		<li class="stat">{garden.waterCan} <span>清水</span></li>
		<li class="stat">{garden.fertilizer} <span>肥料</span></li>
	</ul>

	<section class="dock" aria-label="照料">
		<p class="notice" aria-live="polite">{garden.notice}</p>
		<ul class="twins">
			{#each garden.beds as plot (plot.id)}
				<li>
					<button
						type="button"
						class="twin {selected === plot.id ? 'on' : ''}"
						data-bed={plot.id}
						aria-pressed={selected === plot.id}
						aria-label="盆 {plot.id + 1} {plot.plantId
							? plantById(plot.plantId)?.name
							: '空盆'} {stageName[plot.stage]}"
						onclick={() => chooseBed(plot.id)}
					>
						{plot.plantId ? plantById(plot.plantId)?.name : '空盆'}
						<span>{stageName[plot.stage]}</span>
					</button>
				</li>
			{/each}
		</ul>

		<div class="sheet">
			{#if def && bed}
				<p class="need">
					{def.name}
					{stageName[bed.stage]}
					{#if thirsty}<strong>渴了</strong>{/if}
					{#if hungry}<strong>饿了</strong>{/if}
					需要水{needZh[def.water]} 光{needZh[def.light]} 肥{needZh[def.nutrient]}
					现在水{bed.water} 光{bed.light} 肥{bed.nutrient}
					生机{bed.health}
					{bed.potSize >= 2 ? '大盆' : '小盆'}
				</p>
			{:else}
				<p class="need muted">点窗台上的盆。浇水施肥，熟了再收。蜜蜂蝴蝶瓢虫请留着。</p>
			{/if}

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

			{#if !bed || bed.stage === 'empty' || shopOpen}
				<div class="seeds">
					{#each ownedSeeds as plant (plant.id)}
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
			{/if}

			{#if shopOpen}
				<div class="chips">
					<button
						type="button"
						class="chip {familyFilter === 'all' ? 'on' : ''}"
						onclick={() => (familyFilter = 'all')}>全部</button
					>
					{#each MORPH_FAMILIES as family (family)}
						<button
							type="button"
							class="chip {familyFilter === family ? 'on' : ''}"
							onclick={() => (familyFilter = family)}>{FAMILY_LABEL[family]}</button
						>
					{/each}
				</div>
				<div class="seed-grid">
					{#each nursery as plant (plant.id)}
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
				<div class="buys">
					{#each PLANTS.filter((plant) => plant.unlockAt <= garden.harvests).slice(0, 8) as plant (plant.id)}
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
		</div>
		<div class="actions">
			<Button
				class="min-h-12 min-w-20 px-5"
				variant={primary === 'harvest' ? 'primary' : 'secondary'}
				onclick={doHarvest}
				disabled={bed?.stage !== 'ripe'}>收获</Button
			>
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
			<Button class="min-h-12 min-w-20 px-5" variant="secondary" onclick={doPrune}>修剪</Button>
			<Button class="min-h-12 min-w-20 px-5" variant="secondary" onclick={doRepot}>换盆</Button>
			<Button
				class="min-h-12 min-w-24 px-5"
				variant={primary === 'plant' ? 'primary' : 'secondary'}
				onclick={plantSelected}
			>
				种下{plantById(pickSeed)?.name ?? ''}
			</Button>
			<Button class="min-h-12 min-w-20 px-5" variant="secondary" onclick={doShade}>遮荫</Button>
			<Button
				class="min-h-12 min-w-20 px-5"
				variant={primary === 'clear' ? 'primary' : 'secondary'}
				onclick={doClear}
				disabled={bed?.stage !== 'wilt'}>清空</Button
			>
			<Button class="min-h-12 px-5" variant="secondary" onclick={() => (shopOpen = !shopOpen)}>
				{shopOpen ? '收起种子' : '种子柜'}
			</Button>
		</div>
	</section>

	{#if garden.paused}
		<div class="overlay">
			<p class="text-lg font-semibold">园子先歇着</p>
			<Button class="mt-4" onclick={togglePause}>继续</Button>
		</div>
	{/if}
</div>

<style>
	.chip-bg {
		background: color-mix(in srgb, var(--qx-card) 88%, transparent);
		padding-inline: 0.75rem;
		backdrop-filter: blur(16px);
	}

	.stat {
		border-radius: 1rem;
		background: color-mix(in srgb, var(--qx-card) 88%, transparent);
		padding: 0.4rem 0.65rem;
		font-weight: 600;
		backdrop-filter: blur(16px);
		box-shadow: 0 10px 24px -18px color-mix(in srgb, var(--qx-text) 50%, transparent);
	}

	.stat span {
		display: block;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--qx-muted);
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
		position: absolute;
		inset-inline: 0;
		bottom: 0;
		z-index: 10;
		padding: 0 0.75rem max(0.55rem, env(safe-area-inset-bottom));
	}

	.notice {
		margin: 0 auto 0.35rem;
		max-width: 48rem;
		font-size: 0.85rem;
		color: var(--qx-muted);
		text-shadow: 0 1px 8px color-mix(in srgb, var(--qx-bg) 80%, transparent);
	}

	.twins {
		display: flex;
		gap: 0.3rem;
		max-width: 48rem;
		margin: 0 auto 0.4rem;
		overflow-x: auto;
		padding-bottom: 0.15rem;
	}

	.twin {
		min-height: 2.75rem;
		min-width: 3.4rem;
		border-radius: 0.8rem;
		background: color-mix(in srgb, var(--qx-card) 90%, transparent);
		font-size: 0.7rem;
		padding: 0.25rem 0.4rem;
		backdrop-filter: blur(12px);
	}

	.twin span {
		display: block;
		color: var(--qx-muted);
	}

	.twin.on {
		box-shadow: inset 0 0 0 2px var(--qx-primary);
	}

	.sheet {
		margin: 0 auto;
		max-width: 48rem;
		max-height: 18dvh;
		overflow: auto;
		border-radius: 1.4rem 1.4rem 0.6rem 0.6rem;
		background: color-mix(in srgb, var(--qx-card) 92%, transparent);
		padding: 0.75rem;
		box-shadow: 0 -12px 32px -24px color-mix(in srgb, var(--qx-text) 55%, transparent);
		overscroll-behavior: contain;
		backdrop-filter: blur(18px);
	}

	.need {
		font-size: 0.85rem;
	}

	.need strong {
		margin-right: 0.35rem;
		color: var(--qx-accent-coral);
	}

	.muted {
		color: var(--qx-muted);
	}

	.bugs,
	.seeds,
	.actions,
	.chips,
	.buys {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-top: 0.55rem;
	}

	.actions {
		margin: 0.45rem auto 0;
		max-width: 48rem;
		padding: 0.45rem;
		border-radius: 1.1rem;
		background: color-mix(in srgb, var(--qx-card) 92%, transparent);
		backdrop-filter: blur(16px);
	}

	.seeds {
		flex-wrap: nowrap;
		overflow-x: auto;
		padding-bottom: 0.15rem;
	}

	.seed-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.4rem;
		margin-top: 0.5rem;
	}

	.seed,
	.buy,
	.bug,
	.chip {
		min-height: 2.75rem;
		border-radius: 0.9rem;
		padding: 0.35rem 0.55rem;
		background: var(--qx-surface);
	}

	.bug {
		min-width: 6.5rem;
		min-height: 2.75rem;
		font-weight: 600;
	}

	.seed {
		text-align: center;
		font-size: 0.75rem;
		min-width: 4.4rem;
	}

	.seed.on,
	.chip.on {
		box-shadow: inset 0 0 0 2px var(--qx-primary);
	}

	.seed .meta,
	.bug span {
		display: block;
		color: var(--qx-muted);
		font-weight: 500;
	}

	.bug.pest {
		background: color-mix(in srgb, var(--qx-accent-coral) 22%, var(--qx-card));
	}

	.bug.pollinator,
	.bug.predator {
		background: color-mix(in srgb, var(--qx-accent-teal) 22%, var(--qx-card));
	}

	.overlay {
		position: absolute;
		inset: 0;
		z-index: 20;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, var(--qx-bg) 72%, transparent);
	}

	.twin:focus-visible,
	.seed:focus-visible,
	.buy:focus-visible,
	.bug:focus-visible,
	.chip:focus-visible {
		outline: 2px solid var(--qx-primary);
		outline-offset: 2px;
	}

	@media (min-width: 768px) {
		.seed-grid {
			grid-template-columns: repeat(8, minmax(0, 1fr));
		}

		.sheet {
			max-height: 22dvh;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.chip-bg,
		.stat,
		.twin,
		.sheet {
			backdrop-filter: none;
		}
	}
</style>

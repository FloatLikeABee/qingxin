<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import PlantView from './PlantView.svelte';
	import { readGardenSave, writeGardenSave } from './persist';
	import { PLANTS, plantById, unlockedPlants } from './plants';
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
		refillWater,
		restartGarden,
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

	const bed = $derived(garden.beds[selected]);
	const def = $derived(bed?.plantId ? plantById(bed.plantId) : undefined);
	const nursery = $derived(unlockedPlants(garden.harvests));
	const deadlocked = $derived(isDeadlocked(garden));

	const bugName: Record<BugKind, string> = {
		aphid: '蚜虫',
		snail: '蜗牛',
		bee: '蜜蜂',
		ladybug: '瓢虫'
	};

	const stageName: Record<string, string> = {
		empty: '空畦',
		seed: '种子',
		sprout: '嫩芽',
		leaf: '展叶',
		bud: '花蕾',
		bloom: '开花',
		ripe: '可收获',
		wilt: '枯了'
	};

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

	onMount(() => {
		garden = readGardenSave();
		if (!unlockedPlants(garden.harvests).some((plant) => plant.id === pickSeed)) {
			pickSeed = 'tomato';
		}
		let acc = 0;
		let last = performance.now();
		let raf = 0;
		const loop = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			if (!garden.paused && !document.hidden) {
				acc += dt;
				while (acc >= 0.1) {
					tickGarden(garden);
					acc -= 0.1;
				}
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		const onVis = () => {
			if (document.hidden) garden.paused = true;
		};
		const onHide = () => save();
		document.addEventListener('visibilitychange', onVis);
		window.addEventListener('pagehide', onHide);
		const interval = setInterval(save, 4000);
		return () => {
			cancelAnimationFrame(raf);
			clearInterval(interval);
			document.removeEventListener('visibilitychange', onVis);
			window.removeEventListener('pagehide', onHide);
			save();
		};
	});
</script>

<svelte:head>
	<title>轻心 · {title}</title>
</svelte:head>

<div class="garden-play flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-[var(--qx-bg)]">
	<header
		class="flex shrink-0 items-center gap-2 px-3 pt-[max(0.55rem,env(safe-area-inset-top))] md:px-5"
	>
		<a href="/modules/games" class="{LINK_CLASS} shrink-0">← 返回目录</a>
		<h1 class="sr-only">{title}</h1>
		<div class="ml-auto flex gap-2">
			<Button variant="secondary" class="px-4" onclick={togglePause}>
				{garden.paused ? '继续' : '暂停'}
			</Button>
			<Button variant="secondary" class="px-4" onclick={restart}>重新开始</Button>
		</div>
	</header>

	<ul
		class="mx-auto mt-2 grid w-full max-w-3xl shrink-0 grid-cols-3 gap-2 px-3 md:grid-cols-4 md:px-5"
	>
		<li class="stat">{garden.coins} <span>收成币</span></li>
		<li class="stat">{garden.waterCan} <span>清水</span></li>
		<li class="stat">{garden.fertilizer} <span>肥料</span></li>
	</ul>

	<p class="mx-auto mt-2 w-full max-w-3xl shrink-0 px-3 text-sm text-[var(--qx-muted)] md:px-5">
		{garden.notice}
	</p>

	<div
		class="beds-scroll mx-auto mt-2 grid min-h-0 w-full max-w-3xl flex-1 grid-cols-3 content-start gap-2 overflow-y-auto px-3 md:grid-cols-4 md:px-5"
	>
		{#each garden.beds as plot (plot.id)}
			<button
				type="button"
				class="bed {selected === plot.id ? 'on' : ''}"
				data-bed={plot.id}
				aria-pressed={selected === plot.id}
				aria-label="畦 {plot.id + 1}"
				onclick={() => chooseBed(plot.id)}
			>
				<PlantView plantId={plot.plantId} stage={plot.stage} />
				<span class="bed-name">
					{plot.plantId ? plantById(plot.plantId)?.name : '空畦'}
				</span>
			</button>
		{/each}
	</div>

	<section class="dock">
		<div class="sheet">
			<p class="text-sm text-[var(--qx-muted)]">
				选一畦，种下，浇水施肥。蜜蜂和瓢虫请留着。简化玩法，不是园艺建议。
			</p>
			{#if def && bed}
				<p class="mt-2 text-sm">
					{def.name}
					{stageName[bed.stage] ?? bed.stage}
					水{bed.water}
					光{bed.light}
					肥{bed.nutrient}
					生机{bed.health}
				</p>
				<div class="mt-2 flex flex-wrap gap-1">
					{#each bed.bugs as bug (bug.id)}
						<button type="button" class="bug {bug.role}" onclick={() => doCatch(bug.id)}>
							捉走{bugName[bug.kind]}
							<span>{bug.role === 'pest' ? '害虫' : '益虫'}</span>
						</button>
					{/each}
				</div>
			{/if}

			<div class="mt-3 flex gap-2 overflow-x-auto pb-1">
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

			<div class="mt-3 flex flex-wrap gap-2">
				<Button class="px-4" onclick={plantSelected}>种下{plantById(pickSeed)?.name ?? ''}</Button>
				<Button variant="secondary" class="px-4" onclick={doWater}>浇水</Button>
				<Button variant="secondary" class="px-4" onclick={doFeed}>施肥</Button>
				<Button variant="secondary" class="px-4" onclick={doShade}>遮荫</Button>
				<Button
					variant="secondary"
					class="px-4"
					onclick={doHarvest}
					disabled={bed?.stage !== 'ripe'}>收获</Button
				>
				<Button variant="secondary" class="px-4" onclick={doClear} disabled={bed?.stage !== 'wilt'}
					>清空</Button
				>
			</div>

			<div class="mt-2 flex flex-wrap gap-2">
				{#each PLANTS.filter((plant) => plant.unlockAt <= garden.harvests).slice(0, 6) as plant (plant.id)}
					<button type="button" class="buy" onclick={() => doBuy(plant.id)}>
						买{plant.name}
						{plant.seedCost}
					</button>
				{/each}
				<button type="button" class="buy" onclick={doRefill}>加水 5</button>
				<button type="button" class="buy" onclick={doFert}>买肥 4</button>
				{#if deadlocked}
					<Button onclick={doKit}>空园补给</Button>
				{/if}
			</div>
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
	.stat {
		border-radius: 1rem;
		background: var(--qx-card);
		padding: 0.4rem 0.65rem;
		font-weight: 600;
		box-shadow: 0 10px 24px -18px rgb(15 23 42 / 0.5);
	}

	.stat span {
		display: block;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--qx-muted);
	}

	.bed {
		min-height: 5.1rem;
		border-radius: 1.1rem;
		background: color-mix(in srgb, var(--qx-card) 92%, var(--qx-accent-teal));
		padding: 0.35rem;
		text-align: left;
		box-shadow: inset 0 0 0 1px var(--qx-line);
	}

	.bed.on {
		box-shadow: inset 0 0 0 2px var(--qx-primary);
	}

	.bed-name {
		display: block;
		padding: 0 0.2rem;
		font-size: 0.75rem;
		color: var(--qx-muted);
	}

	.beds-scroll {
		overscroll-behavior: contain;
	}

	.dock {
		flex-shrink: 0;
		padding: 0 0.75rem max(0.6rem, env(safe-area-inset-bottom));
	}

	.sheet {
		margin: 0 auto;
		max-width: 48rem;
		max-height: 38dvh;
		overflow: auto;
		border-radius: 1.4rem 1.4rem 0.6rem 0.6rem;
		background: color-mix(in srgb, var(--qx-card) 94%, transparent);
		padding: 0.85rem;
		box-shadow: 0 -12px 32px -24px rgb(15 23 42 / 0.55);
		overscroll-behavior: contain;
	}

	.seed,
	.buy,
	.bug {
		flex: 0 0 auto;
		min-height: 2.75rem;
		border-radius: 0.9rem;
		padding: 0.35rem 0.55rem;
		background: var(--qx-surface);
	}

	.seed {
		width: 4.8rem;
		text-align: center;
		font-size: 0.75rem;
	}

	.seed.on {
		box-shadow: inset 0 0 0 2px var(--qx-primary);
	}

	.seed .meta,
	.bug span {
		display: block;
		color: var(--qx-muted);
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

	.bed:focus-visible,
	.seed:focus-visible,
	.buy:focus-visible,
	.bug:focus-visible {
		outline: 2px solid var(--qx-primary);
		outline-offset: 2px;
	}
</style>

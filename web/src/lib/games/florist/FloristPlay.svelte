<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import BouquetView from './BouquetView.svelte';
	import { readFloristSave, writeFloristResult, type FloristSave } from './persist';
	import {
		addStem,
		createFlorist,
		guestLine,
		handAssembling,
		handWindow,
		openShop,
		putInWindow,
		restartFlorist,
		summarizeFlorist,
		tickFlorist,
		undoStem
	} from './sim';
	import { STEMS, STEM_IDS } from './stems';

	let { title }: { title: string } = $props();

	let sim = $state(createFlorist());
	let best = $state<FloristSave>({ bestSatisfaction: 0, bestHappy: 0 });
	let recorded = $state(false);
	const summary = $derived(sim.over ? summarizeFlorist(sim) : null);

	function clock(): string {
		if (sim.phase === 'prep') {
			const sec = Math.max(0, Math.ceil((sim.prepTicks - sim.tick) / 10));
			return `配橱窗 ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
		}
		return `来客 ${sim.stats.happy + sim.stats.unhappy}/${sim.dayGuests}`;
	}

	function togglePause() {
		if (sim.over) return;
		sim.paused = !sim.paused;
	}

	function restart() {
		restartFlorist(sim);
		recorded = false;
	}

	function onSlot(slot: number) {
		if (sim.guest && sim.window[slot]) {
			handWindow(sim, slot);
			return;
		}
		putInWindow(sim, slot);
	}

	$effect(() => {
		if (sim.over && !recorded) {
			best = writeFloristResult(summarizeFlorist(sim));
			recorded = true;
		}
	});

	onMount(() => {
		best = readFloristSave();
		let raf = 0;
		let acc = 0;
		let last = performance.now();
		const loop = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			if (!sim.paused && !sim.over) {
				acc += dt;
				while (acc >= 0.1) {
					tickFlorist(sim);
					acc -= 0.1;
				}
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});
</script>

<svelte:head>
	<title>轻心 · {title}</title>
</svelte:head>

<div class="florist-play relative h-dvh min-h-0 w-full overflow-hidden bg-[var(--qx-bg)]">
	<header
		class="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-3 pt-[max(0.6rem,env(safe-area-inset-top))] md:px-5"
	>
		<a
			href="/modules/games"
			class="{LINK_CLASS} pointer-events-auto shrink-0 bg-[color-mix(in_srgb,var(--qx-card)_88%,transparent)] px-3 backdrop-blur-xl"
		>
			← 返回目录
		</a>
		<h1 class="sr-only">{title}</h1>
		<p
			class="hidden min-w-0 flex-1 truncate rounded-2xl bg-[color-mix(in_srgb,var(--qx-card)_88%,transparent)] px-3 py-2 font-[Outfit] text-base font-semibold backdrop-blur-xl md:block"
		>
			{title}
		</p>
		<div class="pointer-events-auto ml-auto flex shrink-0 gap-2">
			<Button variant="secondary" class="px-4" onclick={togglePause} disabled={sim.over}>
				{sim.paused ? '继续' : '暂停'}
			</Button>
			<Button variant="secondary" class="px-4" onclick={restart}>重新开始</Button>
		</div>
	</header>

	<div class="shop absolute inset-0 flex flex-col pt-16 md:pt-20">
		<section class="window-wall relative mx-3 flex min-h-0 flex-1 flex-col overflow-hidden md:mx-5">
			<div class="sky" aria-hidden="true"></div>
			<div class="shopfront">
				<div class="sign">街角花店</div>
				<div class="awning" aria-hidden="true"></div>
				<div class="sill-row">
					{#each sim.window as bouquet, slot (slot)}
						<button
							type="button"
							class="vase-slot"
							onclick={() => onSlot(slot)}
							aria-label="橱窗 {slot + 1}"
						>
							<BouquetView stems={bouquet?.stems ?? []} />
							<span class="vase"></span>
							<span class="slot-n">{slot + 1}</span>
						</button>
					{/each}
					<div class="door {sim.guest ? 'occupied' : ''}">
						<span class="door-glass"></span>
						{#if sim.guest}
							<span class="caller"></span>
						{/if}
					</div>
				</div>
			</div>
			<p class="want">
				{#if sim.phase === 'prep'}
					先把橱窗配上花，再开门等人。
				{:else if sim.guest}
					门口：{guestLine(sim.guest)}
				{:else}
					门口还没有人。桌上那束也可以先放进橱窗。
				{/if}
			</p>
		</section>

		<section
			class="bench mx-3 mb-[max(0.7rem,env(safe-area-inset-bottom))] rounded-3xl bg-[color-mix(in_srgb,var(--qx-card)_92%,transparent)] p-3 ring-1 ring-[var(--qx-line)] md:mx-5 md:p-4"
		>
			<p class="mb-2 text-sm text-[var(--qx-muted)]">{clock()} · 从桶里取花，点橱窗放进去。</p>
			<div class="flex gap-2 overflow-x-auto pb-1">
				{#each STEM_IDS as stem (stem)}
					<button
						type="button"
						class="bucket"
						style="--c:{STEMS[stem].color}"
						onclick={() => addStem(sim, stem)}
						disabled={sim.over || sim.buckets[stem] <= 0}
					>
						<span class="bucket-bloom"></span>
						<span class="font-medium">{STEMS[stem].name}</span>
						<span class="meta">{STEMS[stem].mood} · {sim.buckets[stem]}</span>
					</button>
				{/each}
			</div>
			<div class="mt-3 flex flex-wrap items-center gap-2">
				<div class="assembling" aria-label="正在配的花束">
					<BouquetView stems={sim.assembling} compact />
					<span class="text-sm text-[var(--qx-muted)]">
						{sim.assembling.length
							? sim.assembling.map((id) => STEMS[id].name).join('、')
							: '工作台空着'}
					</span>
				</div>
				<Button onclick={() => undoStem(sim)} variant="secondary" disabled={!sim.assembling.length}>
					拆一枝
				</Button>
				{#if sim.phase === 'prep'}
					<Button onclick={() => openShop(sim)}>开门</Button>
				{:else}
					<Button
						onclick={() => handAssembling(sim)}
						disabled={!sim.guest || !sim.assembling.length}
					>
						递给来客
					</Button>
				{/if}
			</div>
		</section>
	</div>

	{#if sim.paused && !sim.over}
		<div class="overlay">
			<p class="font-[Outfit] text-2xl font-semibold">暂停</p>
			<p class="mt-2 text-[var(--qx-muted)]">花还在水瓶里。客人在门外。</p>
			<Button class="mt-5" onclick={togglePause}>继续</Button>
		</div>
	{/if}

	{#if summary}
		<div class="overlay">
			<article
				class="w-full max-w-md rounded-3xl bg-[var(--qx-card)] p-6 text-left ring-1 ring-[var(--qx-line)]"
			>
				<h2 class="font-[Outfit] text-2xl font-semibold">打烊了</h2>
				<p class="mt-2 text-[var(--qx-muted)]">
					今天的花送出去了。橱窗里还剩 {summary.windowLeft} 束。
				</p>
				<dl class="mt-5 grid grid-cols-2 gap-3">
					<div>
						<dt class="text-sm text-[var(--qx-muted)]">满意</dt>
						<dd class="text-xl font-semibold">{summary.happy}</dd>
					</div>
					<div>
						<dt class="text-sm text-[var(--qx-muted)]">走掉</dt>
						<dd class="text-xl font-semibold">{summary.unhappy}</dd>
					</div>
				</dl>
				<p class="mt-4 text-sm text-[var(--qx-muted)]">
					记下的最好一天：满意 {best.bestHappy} 人
				</p>
				<div class="mt-6 flex flex-wrap gap-2">
					<Button onclick={restart}>重新开始</Button>
					<Button variant="secondary" href="/modules/games">返回目录</Button>
				</div>
			</article>
		</div>
	{/if}
</div>

<style>
	.sky {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(
				ellipse at 18% 20%,
				color-mix(in srgb, var(--qx-accent-coral) 35%, white),
				transparent 42%
			),
			linear-gradient(180deg, #9ec9ff, #f8c9c0 58%, #e7f6f1);
	}

	:global(.dark) .sky {
		background:
			radial-gradient(
				ellipse at 18% 20%,
				color-mix(in srgb, var(--qx-accent-coral) 28%, #1e3a5f),
				transparent 46%
			),
			linear-gradient(180deg, #1e3a5f, #15253a 70%, #0b1526);
	}

	.shopfront {
		position: relative;
		z-index: 1;
		margin-top: auto;
		border-radius: 1.4rem 1.4rem 0.6rem 0.6rem;
		background: color-mix(in srgb, var(--qx-card) 82%, #f4e7d0);
		box-shadow: 0 18px 36px -24px rgba(15, 23, 42, 0.45);
		padding: 1.4rem 0.55rem 0.45rem;
	}

	.sign {
		position: absolute;
		top: -0.7rem;
		left: 50%;
		z-index: 2;
		translate: -50% 0;
		border-radius: 0.45rem;
		background: var(--qx-primary);
		color: white;
		padding: 0.2rem 0.9rem;
		font-family: Outfit, var(--font-sans);
		font-size: 0.9rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.awning {
		position: absolute;
		top: 0.55rem;
		right: 0.4rem;
		left: 0.4rem;
		height: 0.55rem;
		border-radius: 0.2rem;
		background: repeating-linear-gradient(
			90deg,
			var(--qx-accent-coral) 0 0.7rem,
			var(--qx-accent-gold) 0.7rem 1.4rem
		);
	}

	.sill-row {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr)) 4.5rem;
		align-items: end;
		gap: 0.4rem;
		padding-top: 0.55rem;
	}

	@media (min-width: 768px) {
		.vase-slot {
			min-height: 12rem;
		}

		.door {
			height: 11rem;
		}
	}

	.vase-slot {
		display: flex;
		min-height: 8.2rem;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		border-radius: 0.9rem 0.9rem 0.25rem 0.25rem;
		background: color-mix(in srgb, #9ec9ff 28%, white);
		box-shadow: inset 0 0 0 2px color-mix(in srgb, white 55%, transparent);
		padding-bottom: 0.35rem;
	}

	.vase {
		width: 1.9rem;
		height: 1.55rem;
		border-radius: 0.15rem 0.15rem 0.85rem 0.85rem;
		background: color-mix(in srgb, var(--qx-accent-teal) 55%, white);
		box-shadow: inset 0 2px 0 color-mix(in srgb, white 45%, transparent);
	}

	.slot-n {
		font-size: 0.7rem;
		color: var(--qx-muted);
	}

	.door {
		position: relative;
		height: 7.2rem;
		border-radius: 0.8rem 0.8rem 0.2rem 0.2rem;
		background: color-mix(in srgb, var(--qx-card) 70%, #c48a58);
		box-shadow: inset 0 0 0 3px color-mix(in srgb, #c48a58 70%, white);
	}

	.door-glass {
		position: absolute;
		inset: 0.55rem 0.45rem 1.4rem;
		border-radius: 0.3rem;
		background: color-mix(in srgb, #9ec9ff 45%, white);
	}

	.caller {
		position: absolute;
		left: 50%;
		bottom: 0.35rem;
		width: 1.1rem;
		height: 2.1rem;
		translate: -50% 0;
		border-radius: 0.6rem 0.6rem 0.2rem 0.2rem;
		background: #3b82f6;
		box-shadow: 0 -0.7rem 0 -0.22rem #f2c7a4;
	}

	.want {
		position: relative;
		z-index: 1;
		margin: 0.45rem 0.2rem 0.6rem;
		border-radius: 1rem;
		background: color-mix(in srgb, var(--qx-card) 86%, transparent);
		padding: 0.45rem 0.75rem;
		font-size: 0.95rem;
	}

	.bucket {
		display: flex;
		min-height: 44px;
		min-width: 5.6rem;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.1rem;
		border-radius: 1rem;
		background: var(--qx-surface);
		padding: 0.55rem 0.7rem;
		text-align: left;
	}

	.bucket:disabled {
		opacity: 0.45;
	}

	.bucket-bloom {
		height: 0.55rem;
		width: 1.4rem;
		border-radius: 999px;
		background: var(--c);
	}

	.meta {
		font-size: 0.75rem;
		color: var(--qx-muted);
	}

	.assembling {
		display: flex;
		min-height: 44px;
		min-width: 9rem;
		align-items: center;
		gap: 0.5rem;
		border-radius: 1rem;
		background: var(--qx-surface);
		padding: 0.25rem 0.7rem;
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
		padding: 1rem;
		text-align: center;
	}
</style>

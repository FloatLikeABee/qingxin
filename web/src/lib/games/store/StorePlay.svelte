<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import { GOODS, SKUS, type SkuId } from './goods';
	import { readStoreSave, writeDayResult, type StoreSave } from './persist';
	import { createSim, orderCrate, restockShelf, restartSim, summarize, tick } from './sim';
	import type { StoreScene } from './render';

	let { title }: { title: string } = $props();

	let sim = $state(createSim());
	let selected = $state(0);
	let best = $state<StoreSave>({ bestRevenue: 0, bestSatisfaction: 0 });
	let recorded = $state(false);
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let stageEl = $state<HTMLDivElement | null>(null);
	let sceneFailed = $state(false);

	const remaining = $derived(Math.max(0, sim.dayTicks - sim.tick));
	const clock = $derived(formatClock(remaining));
	const selectedShelf = $derived(sim.shelves.find((shelf) => shelf.id === selected));
	const guests = $derived(sim.stats.customersHappy + sim.stats.customersUnhappy);
	const summary = $derived(sim.over ? summarize(sim) : null);

	function formatClock(ticks: number): string {
		const sec = Math.max(0, Math.ceil(ticks / 10));
		return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
	}

	function yuan(n: number): string {
		return `¥${n}`;
	}

	function percent(n: number): string {
		return `${Math.round(n * 100)}%`;
	}

	function restockSelected() {
		if (selectedShelf) restockShelf(sim, selectedShelf.id);
	}

	function orderSku(sku: SkuId) {
		orderCrate(sim, sku);
	}

	function togglePause() {
		if (sim.over) return;
		sim.paused = !sim.paused;
	}

	function restart() {
		restartSim(sim);
		recorded = false;
		selected = 0;
	}

	$effect(() => {
		if (sim.over && !recorded) {
			best = writeDayResult(summarize(sim));
			recorded = true;
		}
	});

	onMount(() => {
		best = readStoreSave();
		let scene: StoreScene | null = null;
		let raf = 0;
		let acc = 0;
		let last = performance.now();
		let dragging = false;
		let moved = false;
		let lastX = 0;
		const canvas = canvasEl;
		const stage = stageEl;
		if (!canvas || !stage) return;

		let resizeObserver: ResizeObserver | undefined;
		let onResize: (() => void) | undefined;
		let onDown: ((event: PointerEvent) => void) | undefined;
		let onMove: ((event: PointerEvent) => void) | undefined;
		let onUp: ((event: PointerEvent) => void) | undefined;
		let cancelled = false;

		void (async () => {
			const { mountStoreScene } = await import('./render');
			if (cancelled) return;
			scene = mountStoreScene(canvas);
			if (!scene) {
				sceneFailed = true;
				return;
			}
			scene.resize();
			canvas.dataset.ready = '1';
			onResize = () => scene?.resize();
			resizeObserver = new ResizeObserver(onResize);
			resizeObserver.observe(stage);
			window.addEventListener('resize', onResize);

			onDown = (event: PointerEvent) => {
				if (event.pointerType === 'mouse' && event.button !== 0) return;
				dragging = true;
				moved = false;
				lastX = event.clientX;
				stage.setPointerCapture(event.pointerId);
			};
			onMove = (event: PointerEvent) => {
				if (!dragging) return;
				const dx = event.clientX - lastX;
				if (Math.abs(dx) > 4) moved = true;
				lastX = event.clientX;
				scene?.orbit(dx);
			};
			onUp = (event: PointerEvent) => {
				if (!dragging) return;
				dragging = false;
				if (!moved) {
					const id = scene?.pick(event.clientX, event.clientY);
					if (id != null) selected = id;
				}
			};
			stage.addEventListener('pointerdown', onDown);
			stage.addEventListener('pointermove', onMove);
			stage.addEventListener('pointerup', onUp);
			stage.addEventListener('pointercancel', onUp);

			const loop = (now: number) => {
				const dt = Math.min(0.05, (now - last) / 1000);
				last = now;
				if (!sim.paused && !sim.over) {
					acc += dt;
					while (acc >= 0.1) {
						tick(sim);
						acc -= 0.1;
					}
				}
				scene?.sync(sim, selected);
				scene?.render(now);
				raf = requestAnimationFrame(loop);
			};
			raf = requestAnimationFrame(loop);
		})();

		return () => {
			cancelled = true;
			cancelAnimationFrame(raf);
			resizeObserver?.disconnect();
			if (onResize) window.removeEventListener('resize', onResize);
			if (onDown) stage.removeEventListener('pointerdown', onDown);
			if (onMove) stage.removeEventListener('pointermove', onMove);
			if (onUp) {
				stage.removeEventListener('pointerup', onUp);
				stage.removeEventListener('pointercancel', onUp);
			}
			scene?.dispose();
		};
	});
</script>

<svelte:head>
	<title>轻心 · {title}</title>
</svelte:head>

<div class="store-play relative h-dvh min-h-0 w-full overflow-hidden bg-[var(--qx-bg)]">
	<div bind:this={stageEl} class="absolute inset-0 touch-none" data-play="store">
		<canvas bind:this={canvasEl} class="h-full w-full" aria-label="便利店三维店面"></canvas>
		{#if sceneFailed}
			<p
				class="absolute inset-0 flex items-center justify-center px-6 text-center text-[var(--qx-muted)]"
			>
				这台设备画不出店面，货架操作仍可用。
			</p>
		{/if}
	</div>

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
			class="hidden min-w-0 flex-1 truncate rounded-2xl bg-[color-mix(in_srgb,var(--qx-card)_88%,transparent)] px-3 py-2 font-[Outfit] text-base font-semibold backdrop-blur-xl md:block md:text-lg"
		>
			{title}
		</p>
		<div class="pointer-events-auto flex shrink-0 gap-2">
			<Button variant="secondary" class="px-4" onclick={togglePause} disabled={sim.over}>
				{sim.paused ? '继续' : '暂停'}
			</Button>
			<Button variant="secondary" class="px-4" onclick={restart}>重新开始</Button>
		</div>
	</header>

	<ul
		class="pointer-events-none absolute inset-x-0 top-16 z-10 mx-auto grid max-w-3xl grid-cols-2 gap-2 px-3 md:top-20 md:grid-cols-4 md:px-5"
	>
		<li class="stat">{yuan(sim.cash)} <span>现金</span></li>
		<li class="stat">{yuan(sim.stats.revenue)} <span>营收</span></li>
		<li class="stat">{clock} <span>班次</span></li>
		<li class="stat">{sim.stats.customersHappy}/{Math.max(guests, 0)} <span>满意</span></li>
	</ul>

	<section
		class="absolute inset-x-0 bottom-0 z-10 px-3 pb-[max(0.7rem,env(safe-area-inset-bottom))] md:px-5"
	>
		<div
			class="mx-auto max-w-4xl rounded-3xl bg-[color-mix(in_srgb,var(--qx-card)_90%,transparent)] p-3 ring-1 ring-[var(--qx-line)] backdrop-blur-xl md:p-4"
		>
			<p class="mb-2 text-sm text-[var(--qx-muted)]">
				点货架或点下面的货。库房有货就能补上；钱够再进一箱。
			</p>
			<div class="flex gap-2 overflow-x-auto pb-1">
				{#each sim.shelves as shelf (shelf.id)}
					{@const goods = GOODS[shelf.sku]}
					<button
						type="button"
						class="sku-card {selected === shelf.id ? 'sku-card-on' : ''}"
						onclick={() => (selected = shelf.id)}
					>
						<span class="swatch" style="background:{goods.color}"></span>
						<span class="font-medium">{goods.name}</span>
						<span class="meta">架上 {shelf.stock}/{shelf.capacity}</span>
						<span class="meta">库房 {sim.storage[shelf.sku]}</span>
						<span class="meta">{yuan(goods.price)} / 件</span>
					</button>
				{/each}
			</div>
			<div class="mt-3 flex flex-wrap gap-2">
				<Button onclick={restockSelected} disabled={sim.over}>从库房补货</Button>
				{#if selectedShelf}
					<Button
						variant="secondary"
						onclick={() => orderSku(selectedShelf.sku)}
						disabled={sim.over || sim.cash < GOODS[selectedShelf.sku].crateCost}
					>
						进一箱 {GOODS[selectedShelf.sku].name}
						{yuan(GOODS[selectedShelf.sku].crateCost)}
					</Button>
				{/if}
			</div>
		</div>
	</section>

	{#if sim.paused && !sim.over}
		<div class="overlay">
			<p class="font-[Outfit] text-2xl font-semibold">暂停</p>
			<p class="mt-2 text-[var(--qx-muted)]">客人还在店门口等着。</p>
			<Button class="mt-5" onclick={togglePause}>继续</Button>
		</div>
	{/if}

	{#if summary}
		<div class="overlay">
			<article
				class="w-full max-w-md rounded-3xl bg-[var(--qx-card)] p-6 text-left ring-1 ring-[var(--qx-line)]"
			>
				<h2 class="font-[Outfit] text-2xl font-semibold">班次结束</h2>
				<p class="mt-2 text-[var(--qx-muted)]">今天店里过完了。剩货会过夜，钱留在柜里。</p>
				<dl class="mt-5 grid grid-cols-2 gap-3 text-base">
					<div>
						<dt class="text-sm text-[var(--qx-muted)]">营收</dt>
						<dd class="text-xl font-semibold">{yuan(summary.revenue)}</dd>
					</div>
					<div>
						<dt class="text-sm text-[var(--qx-muted)]">现金</dt>
						<dd class="text-xl font-semibold">{yuan(summary.cash)}</dd>
					</div>
					<div>
						<dt class="text-sm text-[var(--qx-muted)]">客人满意</dt>
						<dd class="text-xl font-semibold">{percent(summary.satisfaction)}</dd>
					</div>
					<div>
						<dt class="text-sm text-[var(--qx-muted)]">剩货</dt>
						<dd class="text-xl font-semibold">{summary.leftoverUnits} 件</dd>
					</div>
				</dl>
				<p class="mt-4 text-sm text-[var(--qx-muted)]">
					记下的最好班次：营收 {yuan(best.bestRevenue)}，满意 {percent(best.bestSatisfaction)}
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
	.stat {
		pointer-events: none;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		border-radius: 1rem;
		background: color-mix(in srgb, var(--qx-card) 88%, transparent);
		padding: 0.55rem 0.75rem;
		font-family: Outfit, var(--font-sans);
		font-size: 1.05rem;
		font-weight: 600;
		backdrop-filter: blur(16px);
	}

	.stat span {
		font-family: var(--font-sans);
		font-size: 0.75rem;
		font-weight: 400;
		color: var(--qx-muted);
	}

	.sku-card {
		display: flex;
		min-height: 44px;
		min-width: 7.5rem;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.15rem;
		border-radius: 1rem;
		background: var(--qx-surface);
		padding: 0.65rem 0.75rem;
		text-align: left;
		transition:
			transform 160ms ease,
			box-shadow 160ms ease;
	}

	.sku-card-on {
		box-shadow: 0 0 0 2px var(--qx-primary);
		background: var(--qx-card);
	}

	.swatch {
		height: 0.45rem;
		width: 1.6rem;
		border-radius: 999px;
	}

	.meta {
		font-size: 0.75rem;
		color: var(--qx-muted);
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

	@media (prefers-reduced-motion: reduce) {
		.sku-card {
			transition: none;
		}
	}
</style>

<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import { readNightSave, writeNightResult, type NightSave } from './persist';
	import ShardArt from './ShardArt.svelte';
	import {
		COLS,
		createNight,
		gust,
		motifLabel,
		placeShard,
		restartNight,
		tickNight,
		type NightPiece
	} from './sim';

	let { title }: { title: string } = $props();

	let night = $state(createNight());
	let selected = $state<string | null>(null);
	let best = $state<NightSave>({
		bestMisses: Number.POSITIVE_INFINITY,
		bestTicks: Number.POSITIVE_INFINITY
	});
	let recorded = $state(false);
	let windNote = $state(false);
	let windTimer: ReturnType<typeof setTimeout> | undefined;

	function flashWind() {
		windNote = true;
		clearTimeout(windTimer);
		windTimer = setTimeout(() => (windNote = false), 900);
	}

	const placed = $derived(night.slots.filter(Boolean).length);
	const clock = $derived(formatClock(night.tick));

	function formatClock(ticks: number): string {
		const sec = Math.max(0, Math.floor(ticks / 10));
		return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
	}

	function pieceInSlot(index: number): NightPiece | undefined {
		const id = night.slots[index];
		if (!id) return undefined;
		const cell = night.cells[index];
		if (!cell) return undefined;
		return { id, home: cell.index, motif: cell.motif, hue: cell.hue };
	}

	function choose(id: string) {
		selected = selected === id ? null : id;
	}

	function tryPlace(slot: number) {
		if (!selected) return;
		const ok = placeShard(night, selected, slot);
		if (ok) selected = null;
	}

	function blow() {
		gust(night);
		flashWind();
	}

	function togglePause() {
		if (night.complete) return;
		night.paused = !night.paused;
	}

	function restart() {
		restartNight(night);
		selected = null;
		recorded = false;
	}

	$effect(() => {
		if (night.complete && !recorded) {
			best = writeNightResult(night.misses, night.tick);
			recorded = true;
		}
	});

	onMount(() => {
		best = readNightSave();
		let raf = 0;
		let acc = 0;
		let last = performance.now();
		const loop = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			if (!night.paused && !night.complete) {
				acc += dt;
				while (acc >= 0.1) {
					const before = night.tray.map((piece) => piece.id).join(',');
					tickNight(night);
					const after = night.tray.map((piece) => piece.id).join(',');
					if (before !== after) flashWind();
					acc -= 0.1;
				}
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => {
			cancelAnimationFrame(raf);
			clearTimeout(windTimer);
		};
	});
</script>

<svelte:head>
	<title>轻心 · {title}</title>
</svelte:head>

<div
	class="night-play relative h-dvh min-h-0 w-full overflow-hidden bg-[#0b1526] text-[var(--qx-text)]"
>
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
			<Button variant="secondary" class="px-4" onclick={togglePause} disabled={night.complete}>
				{night.paused ? '继续' : '暂停'}
			</Button>
			<Button variant="secondary" class="px-4" onclick={restart}>重新开始</Button>
		</div>
	</header>

	<div class="stage absolute inset-0 flex flex-col pt-16 md:pt-20">
		<p class="px-4 text-sm text-[#9ca3af] md:px-6">
			{windNote ? '风又来了一阵。' : '点一块夜色，再点窗上的空位。'}
			已拼 {placed}/12 · 错 {night.misses} · {clock}
		</p>
		<div class="window-frame mx-3 mt-2 min-h-0 flex-1 md:mx-auto md:w-full md:max-w-3xl">
			<div
				class="grid h-full grid-cols-4 grid-rows-3 gap-1 p-2 md:gap-1.5 md:p-3"
				style="grid-template-columns:repeat({COLS},minmax(0,1fr))"
			>
				{#each night.cells as cell (cell.index)}
					{@const filled = pieceInSlot(cell.index)}
					<button
						type="button"
						class="cell {filled ? 'lit' : 'rift'}"
						onclick={() => tryPlace(cell.index)}
						aria-label={filled ? motifLabel(cell.motif) : `空位 ${cell.row + 1}-${cell.col + 1}`}
					>
						{#if filled}
							<ShardArt motif={filled.motif} hue={filled.hue} />
						{:else}
							<span class="memory">
								<ShardArt motif={cell.motif} hue={cell.hue} />
							</span>
							<span class="gap-wind"></span>
						{/if}
					</button>
				{/each}
			</div>
		</div>
		<section
			class="tray mx-3 mt-3 mb-[max(0.7rem,env(safe-area-inset-bottom))] rounded-3xl bg-[color-mix(in_srgb,#15253a_92%,transparent)] p-3 ring-1 ring-[#2a3d5c] md:mx-5"
		>
			<div class="mb-2 flex items-center justify-between gap-2">
				<p class="text-sm text-[#9ca3af]">夜色拼块 · 左右滑动</p>
				<Button variant="secondary" class="px-4" onclick={blow} disabled={night.complete}
					>风来了</Button
				>
			</div>
			<div class="flex gap-2 overflow-x-auto pb-1">
				{#each night.tray as piece (piece.id)}
					<button
						type="button"
						class="chip {selected === piece.id ? 'on' : ''}"
						onclick={() => choose(piece.id)}
					>
						<div class="preview">
							<ShardArt motif={piece.motif} hue={piece.hue} />
						</div>
						<span>{motifLabel(piece.motif)}</span>
					</button>
				{/each}
			</div>
		</section>
	</div>

	{#if night.paused && !night.complete}
		<div class="overlay">
			<p class="font-[Outfit] text-2xl font-semibold text-white">暂停</p>
			<p class="mt-2 text-[#9ca3af]">风在窗外等着。</p>
			<Button class="mt-5" onclick={togglePause}>继续</Button>
		</div>
	{/if}

	{#if night.complete}
		<div class="overlay">
			<article
				class="w-full max-w-md rounded-3xl bg-[#15253a] p-6 text-left text-white ring-1 ring-[#2a3d5c]"
			>
				<h2 class="font-[Outfit] text-2xl font-semibold">夜色回来了</h2>
				<p class="mt-2 text-[#9ca3af]">灯窗又亮了。风停在窗框上。</p>
				<p class="mt-4 text-base">用了 {clock}，错了 {night.misses} 次。</p>
				{#if Number.isFinite(best.bestMisses)}
					<p class="mt-2 text-sm text-[#9ca3af]">
						最好：错 {best.bestMisses === Number.POSITIVE_INFINITY ? '—' : best.bestMisses} 次
					</p>
				{/if}
				<div class="mt-6 flex flex-wrap gap-2">
					<Button onclick={restart}>重新开始</Button>
					<Button variant="secondary" href="/modules/games">返回目录</Button>
				</div>
			</article>
		</div>
	{/if}
</div>

<style>
	.window-frame {
		border-radius: 1.1rem;
		background: #c48a58;
		box-shadow:
			0 22px 40px -24px rgb(0 0 0 / 0.7),
			inset 0 0 0 6px #8b5a3c;
	}

	.cell {
		position: relative;
		min-height: 0;
		overflow: hidden;
		border-radius: 0.2rem;
	}

	.rift {
		background: #0b1526;
	}

	.memory {
		position: absolute;
		inset: 0;
		opacity: 0.34;
		filter: saturate(0.7);
	}

	.gap-wind {
		position: absolute;
		inset: -20%;
		background: repeating-linear-gradient(
			115deg,
			transparent 0 10px,
			color-mix(in srgb, #60a5fa 18%, transparent) 10px 12px
		);
		animation: shear 1.8s linear infinite;
	}

	.chip {
		display: flex;
		min-height: 44px;
		min-width: 5.4rem;
		flex-direction: column;
		gap: 0.25rem;
		border-radius: 1rem;
		background: #0b1526;
		padding: 0.35rem;
		text-align: left;
		font-size: 0.8rem;
		color: #e5e7eb;
	}

	.chip.on {
		box-shadow: 0 0 0 2px #60a5fa;
	}

	.preview {
		height: 2.6rem;
		overflow: hidden;
		border-radius: 0.55rem;
	}

	.overlay {
		position: absolute;
		inset: 0;
		z-index: 20;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, #0b1526 72%, transparent);
		padding: 1rem;
		text-align: center;
	}

	@keyframes shear {
		to {
			transform: translateX(18px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.gap-wind {
			animation: none;
		}
	}
</style>

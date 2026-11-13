<script lang="ts">
	import { STEMS, type StemId } from './stems';

	let { stems, compact = false }: { stems: StemId[]; compact?: boolean } = $props();
</script>

<div class="bouquet {compact ? 'compact' : ''}" aria-hidden="true">
	{#each stems as stem, index (index)}
		<span class="petal i{index}" style="--c:{STEMS[stem].color}"></span>
	{/each}
	{#if stems.length === 0}
		<span class="empty-neck"></span>
	{/if}
</div>

<style>
	.bouquet {
		position: relative;
		height: 3.2rem;
		width: 2.6rem;
	}

	.compact {
		height: 2.2rem;
		width: 1.8rem;
	}

	.petal {
		position: absolute;
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 55% 45% 50% 50%;
		background: radial-gradient(
			circle at 32% 28%,
			color-mix(in srgb, var(--c) 55%, white),
			var(--c)
		);
		box-shadow: 0 4px 10px -6px rgba(15, 23, 42, 0.45);
	}

	.compact .petal {
		width: 0.78rem;
		height: 0.78rem;
	}

	.i0 {
		left: 0.2rem;
		bottom: 0.45rem;
	}
	.i1 {
		left: 0.85rem;
		bottom: 0.7rem;
	}
	.i2 {
		left: 0.5rem;
		bottom: 1.15rem;
	}
	.i3 {
		left: 1.15rem;
		bottom: 0.35rem;
	}
	.i4 {
		left: 0.05rem;
		bottom: 1.05rem;
	}

	.empty-neck {
		position: absolute;
		inset: auto 40% 0;
		height: 0.7rem;
		border-radius: 0.2rem;
		background: color-mix(in srgb, var(--qx-muted) 35%, transparent);
	}
</style>

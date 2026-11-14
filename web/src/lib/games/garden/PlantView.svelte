<script lang="ts">
	import { plantById } from './plants';
	import type { Stage } from './sim';

	let {
		plantId,
		stage,
		compact = false
	}: {
		plantId: string | null;
		stage: Stage;
		compact?: boolean;
	} = $props();

	const def = $derived(plantId ? plantById(plantId) : undefined);
	const form = $derived(def?.morph.family ?? 'leafy');
</script>

<div
	class="pv {form} {stage}"
	class:compact
	style={def
		? `--stem:${def.palette.stem};--leaf:${def.palette.leaf};--bloom:${def.palette.bloom}`
		: ''}
	aria-hidden="true"
>
	{#if stage === 'empty' || stage === 'seed' || stage === 'wilt'}
		<span class="soil"></span>
		{#if stage !== 'empty'}
			<span class="seed" class:wilt={stage === 'wilt'}></span>
		{/if}
	{:else}
		<span class="stem"></span>
		<span class="leaf l1"></span>
		<span class="leaf l2"></span>
		<span class="leaf l3"></span>
		{#if stage === 'bud' || stage === 'bloom' || stage === 'ripe'}
			<span class="bloom"></span>
		{/if}
		{#if stage === 'ripe'}
			<span class="fruit f1"></span>
			<span class="fruit f2"></span>
		{/if}
	{/if}
</div>

<style>
	.pv {
		position: relative;
		width: 100%;
		height: 4.6rem;
	}

	.pv.compact {
		height: 3.2rem;
	}

	.soil,
	.seed,
	.stem,
	.leaf,
	.bloom,
	.fruit {
		position: absolute;
	}

	.soil {
		inset: auto 12% 8% 12%;
		height: 28%;
		border-radius: 0.4rem;
		background: color-mix(in srgb, var(--qx-accent-gold) 22%, #7c5a32);
	}

	.seed {
		left: 50%;
		bottom: 22%;
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 999px;
		background: var(--bloom, var(--qx-accent-gold));
		transform: translateX(-50%);
		box-shadow: 0 -0.55rem 0 -0.22rem var(--leaf, var(--qx-accent-teal));
	}

	.seed.wilt {
		background: #78716c;
	}

	.stem {
		left: 50%;
		bottom: 12%;
		width: 0.28rem;
		height: 48%;
		border-radius: 0.2rem;
		background: var(--stem);
		transform: translateX(-50%);
	}

	.leaf {
		width: 0.9rem;
		height: 0.55rem;
		border-radius: 80% 20%;
		background: var(--leaf);
		bottom: 38%;
	}

	.l1 {
		left: 18%;
		transform: rotate(-22deg);
	}

	.l2 {
		right: 18%;
		transform: rotate(22deg) scaleX(-1);
	}

	.l3 {
		left: 38%;
		bottom: 52%;
		width: 0.7rem;
		opacity: 0.85;
	}

	.bloom {
		left: 50%;
		top: 8%;
		width: 1.05rem;
		height: 1.05rem;
		border-radius: 999px;
		background: var(--bloom);
		transform: translateX(-50%);
	}

	.fruit {
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 999px;
		background: var(--bloom);
		bottom: 28%;
	}

	.f1 {
		left: 26%;
	}

	.f2 {
		right: 26%;
	}

	.herb .stem {
		width: 0.18rem;
		height: 42%;
		box-shadow: 0.45rem 0.1rem 0 -0.02rem var(--stem);
	}

	.herb .leaf {
		width: 0.7rem;
		height: 0.38rem;
	}

	.leafy .stem {
		height: 22%;
	}

	.leafy .leaf {
		width: 1.35rem;
		height: 0.85rem;
		border-radius: 70%;
		bottom: 22%;
	}

	.leafy .bloom {
		display: none;
	}

	.flower .stem {
		height: 62%;
		width: 0.22rem;
	}

	.flower .bloom {
		width: 1.4rem;
		height: 1.4rem;
		box-shadow: 0 0 0 0.16rem color-mix(in srgb, var(--bloom) 50%, white);
	}

	.vine .stem {
		transform: translateX(-50%) rotate(28deg);
		height: 58%;
	}

	.vine .fruit {
		width: 0.32rem;
		height: 1.05rem;
		border-radius: 999px;
		bottom: 16%;
	}

	.fruiting .fruit {
		width: 0.72rem;
		height: 0.72rem;
	}

	.rosette .stem {
		display: none;
	}

	.rosette .leaf {
		width: 1.2rem;
		height: 0.42rem;
		bottom: 18%;
	}

	.tree .stem {
		width: 0.42rem;
		height: 38%;
		border-radius: 0.2rem 0.2rem 0 0;
	}

	.tree .leaf {
		width: 1.3rem;
		height: 1.15rem;
		border-radius: 1rem;
		bottom: 42%;
	}

	.tree .bloom {
		width: 0.55rem;
		height: 0.55rem;
		top: 18%;
	}

	.succulent .stem {
		width: 0.55rem;
		height: 48%;
		border-radius: 0.45rem;
	}

	.succulent .leaf {
		width: 0.38rem;
		height: 1.15rem;
		border-radius: 999px;
		bottom: 16%;
	}

	.grass .stem {
		width: 0.16rem;
		height: 70%;
		box-shadow:
			0.28rem 0.05rem 0 -0.02rem var(--stem),
			-0.28rem 0.1rem 0 -0.02rem var(--stem);
	}

	.grass .leaf {
		width: 0.22rem;
		height: 1.1rem;
		border-radius: 999px;
		bottom: 22%;
	}

	.aquatic .leaf {
		width: 1.45rem;
		height: 0.32rem;
		border-radius: 999px;
		bottom: 16%;
	}

	.aquatic .bloom {
		width: 0.9rem;
		height: 0.55rem;
		border-radius: 50% 50% 40% 40%;
	}

	@media (prefers-reduced-motion: reduce) {
		.bloom {
			box-shadow: none;
		}
	}
</style>

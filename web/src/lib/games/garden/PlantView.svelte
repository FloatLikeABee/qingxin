<script lang="ts">
	import { plantById, type PlantForm } from './plants';
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
	const form = $derived(def?.form ?? 'moss');
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
		left: 22%;
		transform: rotate(-18deg);
	}

	.l2 {
		right: 22%;
		transform: rotate(18deg) scaleX(-1);
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
		left: 28%;
	}

	.f2 {
		right: 28%;
	}

	.cucumber .fruit,
	.chili .fruit {
		width: 0.35rem;
		height: 1.1rem;
		border-radius: 999px;
		bottom: 22%;
	}

	.eggplant .fruit {
		width: 0.55rem;
		height: 1rem;
		border-radius: 40% 40% 50% 50%;
	}

	.lettuce .bloom,
	.spinach .bloom,
	.cabbage .bloom,
	.mint .bloom,
	.basil .bloom {
		border-radius: 40%;
		width: 1.4rem;
		height: 0.9rem;
		top: 18%;
	}

	.carrot .fruit {
		width: 0.45rem;
		height: 1.15rem;
		border-radius: 40% 40% 60% 60%;
		bottom: 10%;
		left: 42%;
	}

	.onion .bloom,
	.garlic .bloom {
		width: 1.2rem;
		height: 0.7rem;
		border-radius: 50% 50% 40% 40%;
		top: 22%;
	}

	.corn .stem,
	.rice .stem,
	.wheat .stem,
	.bamboo .stem {
		height: 70%;
		width: 0.22rem;
	}

	.sunflower .bloom,
	.chrysanthemum .bloom {
		width: 1.45rem;
		height: 1.45rem;
		box-shadow: 0 0 0 0.18rem color-mix(in srgb, var(--bloom) 55%, white);
	}

	.rose .bloom,
	.peony .bloom {
		border-radius: 42% 58% 40% 60%;
		width: 1.25rem;
		height: 1.15rem;
	}

	.orchid .bloom {
		width: 0.55rem;
		height: 1.2rem;
		border-radius: 60% 60% 20% 20%;
	}

	.lotus .leaf {
		width: 1.3rem;
		height: 0.35rem;
		border-radius: 999px;
		bottom: 22%;
	}

	.pine .leaf,
	.ginkgo .leaf,
	.maple .leaf,
	.apple .leaf,
	.lemon .leaf,
	.tea .leaf {
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 0.2rem 1rem;
		bottom: 42%;
	}

	.ginkgo .leaf {
		border-radius: 0 1rem 0 1rem;
	}

	.maple .leaf {
		border-radius: 0.2rem;
		clip-path: polygon(50% 0, 100% 40%, 80% 100%, 20% 100%, 0 40%);
	}

	.cactus .stem {
		width: 0.7rem;
		height: 58%;
		border-radius: 0.4rem;
	}

	.aloe .leaf,
	.succulent .leaf {
		width: 0.4rem;
		height: 1.3rem;
		border-radius: 999px;
		bottom: 16%;
	}

	.fern .leaf {
		width: 1.4rem;
		height: 0.28rem;
		bottom: 48%;
	}

	.moss .stem {
		display: none;
	}

	.moss .leaf {
		width: 1.6rem;
		height: 0.4rem;
		bottom: 14%;
		border-radius: 1rem;
	}

	.grape .fruit {
		width: 0.38rem;
		height: 0.38rem;
	}

	.strawberry .fruit {
		border-radius: 40% 40% 55% 55%;
	}

	@media (prefers-reduced-motion: reduce) {
		.bloom {
			box-shadow: none;
		}
	}
</style>

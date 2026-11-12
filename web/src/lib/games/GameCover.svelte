<script lang="ts">
	import type { GameCoverArt } from './catalog';

	let {
		cover,
		title,
		class: className = ''
	}: {
		cover: GameCoverArt;
		title: string;
		class?: string;
	} = $props();
</script>

<div
	class="game-cover relative min-h-0 min-w-0 overflow-hidden {className}"
	style="--cover-sky:{cover.sky};--cover-ground:{cover.ground};--cover-accent:{cover.accent}"
	aria-hidden="true"
>
	<div class="cover-sky"></div>
	<div class="cover-ground"></div>
	{#if cover.motif === 'store'}
		<div class="store-build">
			<div class="store-sign">{title}</div>
			<div class="store-awning"></div>
			<div class="store-face">
				<div class="store-window"></div>
				<div class="store-door"></div>
				<div class="store-window"></div>
			</div>
		</div>
		<div class="store-crate"></div>
	{:else if cover.motif === 'flowers'}
		<div class="flower-pot p1"></div>
		<div class="flower-pot p2"></div>
		<div class="flower-pot p3"></div>
		<div class="flower-bloom b1"></div>
		<div class="flower-bloom b2"></div>
		<div class="flower-bloom b3"></div>
	{:else if cover.motif === 'puzzle'}
		<div class="puzzle-tile t1"></div>
		<div class="puzzle-tile t2"></div>
		<div class="puzzle-tile t3"></div>
		<div class="puzzle-tile t4"></div>
		<div class="puzzle-gap"></div>
	{:else if cover.motif === 'wave'}
		<div class="wave w1"></div>
		<div class="wave w2"></div>
		<div class="wave w3"></div>
	{:else if cover.motif === 'cloud'}
		<div class="cloud c1"></div>
		<div class="cloud c2"></div>
		<div class="cloud c3"></div>
		<div class="walk-path"></div>
		<div class="walker"></div>
	{:else}
		<div class="mini-shelf s1"></div>
		<div class="mini-shelf s2"></div>
		<div class="mini-can a"></div>
		<div class="mini-can b"></div>
		<div class="mini-can c"></div>
	{/if}
</div>

<style>
	.game-cover {
		background: var(--cover-sky);
	}

	.cover-sky {
		position: absolute;
		inset: 0 0 38% 0;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--cover-sky) 80%, white),
			var(--cover-sky)
		);
	}

	.cover-ground {
		position: absolute;
		inset: 58% 0 0 0;
		background: var(--cover-ground);
	}

	.store-build {
		position: absolute;
		left: 12%;
		right: 18%;
		bottom: 18%;
		height: 58%;
		border-radius: 0.4rem 0.4rem 0.15rem 0.15rem;
		background: color-mix(in srgb, var(--qx-card) 88%, var(--cover-accent));
		box-shadow: 0 10px 24px -16px rgb(15 23 42 / 0.55);
	}

	.store-sign {
		position: absolute;
		left: 8%;
		right: 8%;
		top: -0.7rem;
		height: 1.15rem;
		border-radius: 0.2rem;
		background: var(--cover-accent);
		color: white;
		font-size: 0.55rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		white-space: nowrap;
		padding: 0 0.35rem;
	}

	.store-awning {
		position: absolute;
		left: -4%;
		right: -4%;
		top: 12%;
		height: 0.55rem;
		background: repeating-linear-gradient(
			90deg,
			var(--qx-accent-coral) 0 10px,
			var(--qx-accent-gold) 10px 20px
		);
		border-radius: 0.15rem;
	}

	.store-face {
		position: absolute;
		inset: 32% 10% 8% 10%;
		display: grid;
		grid-template-columns: 1fr 0.7fr 1fr;
		gap: 0.35rem;
	}

	.store-window {
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--qx-accent-gold) 35%, transparent),
				transparent 55%
			),
			color-mix(in srgb, var(--cover-sky) 40%, white);
		border-radius: 0.15rem 0.15rem 0 0;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--cover-accent) 35%, transparent);
	}

	.store-door {
		background: color-mix(in srgb, var(--cover-accent) 70%, #1f2937);
		border-radius: 0.4rem 0.4rem 0 0;
	}

	.store-crate {
		position: absolute;
		right: 8%;
		bottom: 14%;
		width: 1.4rem;
		height: 1.1rem;
		background: var(--qx-accent-gold);
		border-radius: 0.12rem;
		box-shadow: 0.35rem -0.15rem 0 color-mix(in srgb, var(--qx-accent-coral) 80%, white);
	}

	.flower-pot,
	.flower-bloom {
		position: absolute;
		border-radius: 999px;
	}

	.flower-pot {
		width: 1.1rem;
		height: 1.35rem;
		bottom: 16%;
		background: color-mix(in srgb, var(--cover-accent) 55%, #7c2d12);
		border-radius: 0 0 0.4rem 0.4rem;
	}

	.p1 {
		left: 18%;
	}
	.p2 {
		left: 46%;
		height: 1.6rem;
	}
	.p3 {
		left: 72%;
	}

	.flower-bloom {
		width: 1.35rem;
		height: 1.35rem;
		background: var(--cover-accent);
		bottom: 28%;
	}

	.b1 {
		left: 16%;
		background: var(--qx-accent-coral);
	}
	.b2 {
		left: 44%;
		width: 1.7rem;
		height: 1.7rem;
		background: var(--qx-accent-gold);
	}
	.b3 {
		left: 70%;
		background: #fb7185;
	}

	.puzzle-tile {
		position: absolute;
		width: 28%;
		height: 28%;
		border-radius: 0.45rem;
		background: var(--cover-accent);
	}

	.t1 {
		left: 16%;
		top: 18%;
		opacity: 0.95;
	}
	.t2 {
		left: 48%;
		top: 22%;
		background: color-mix(in srgb, var(--cover-accent) 55%, white);
	}
	.t3 {
		left: 18%;
		top: 52%;
		background: var(--qx-accent-teal);
	}
	.t4 {
		left: 50%;
		top: 56%;
		background: var(--qx-accent-gold);
		opacity: 0.85;
	}

	.puzzle-gap {
		position: absolute;
		left: 48%;
		top: 52%;
		width: 28%;
		height: 28%;
		border-radius: 0.45rem;
		box-shadow: inset 0 0 0 2px color-mix(in srgb, white 35%, transparent);
	}

	.wave {
		position: absolute;
		left: -10%;
		right: -10%;
		height: 42%;
		border-radius: 50%;
		background: color-mix(in srgb, var(--cover-accent) 55%, var(--cover-ground));
	}

	.w1 {
		bottom: -18%;
		opacity: 0.55;
	}
	.w2 {
		bottom: -8%;
		background: color-mix(in srgb, var(--qx-primary) 45%, var(--cover-ground));
		opacity: 0.7;
	}
	.w3 {
		bottom: 4%;
		height: 28%;
		background: color-mix(in srgb, white 35%, var(--cover-sky));
	}

	.cloud {
		position: absolute;
		background: color-mix(in srgb, white 82%, var(--cover-accent));
		border-radius: 999px;
		height: 1.4rem;
	}

	.c1 {
		width: 42%;
		left: 12%;
		top: 22%;
	}
	.c2 {
		width: 28%;
		left: 48%;
		top: 14%;
		height: 1.1rem;
	}
	.c3 {
		width: 34%;
		left: 38%;
		top: 34%;
	}

	.walk-path {
		position: absolute;
		left: 18%;
		right: 18%;
		bottom: 18%;
		height: 0.35rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--cover-accent) 35%, white);
	}

	.walker {
		position: absolute;
		left: 44%;
		bottom: 22%;
		width: 0.55rem;
		height: 1.15rem;
		border-radius: 999px 999px 0.2rem 0.2rem;
		background: var(--cover-accent);
		box-shadow: 0 -0.55rem 0 0.12rem color-mix(in srgb, var(--cover-accent) 70%, white);
	}

	.mini-shelf {
		position: absolute;
		left: 14%;
		right: 14%;
		height: 0.28rem;
		background: color-mix(in srgb, var(--cover-accent) 55%, #7c4a1e);
		border-radius: 0.1rem;
	}

	.s1 {
		bottom: 38%;
	}
	.s2 {
		bottom: 22%;
	}

	.mini-can {
		position: absolute;
		width: 0.7rem;
		height: 1.15rem;
		bottom: 40%;
		border-radius: 0.12rem 0.12rem 0.08rem 0.08rem;
		background: var(--qx-primary);
	}

	.mini-can.a {
		left: 22%;
	}
	.mini-can.b {
		left: 46%;
		background: var(--qx-accent-coral);
		bottom: 24%;
	}
	.mini-can.c {
		left: 68%;
		background: var(--qx-accent-teal);
	}
</style>

<script lang="ts">
	import type { NightMotif } from './sim';

	let { motif, hue = 0.4 }: { motif: NightMotif; hue?: number } = $props();
</script>

<div class="shard motif-{motif}" style="--h:{hue}" aria-hidden="true">
	{#if motif === 'moon'}
		<span class="moon"></span>
	{:else if motif === 'stars'}
		<span class="star s1"></span>
		<span class="star s2"></span>
		<span class="star s3"></span>
	{:else if motif === 'cloud'}
		<span class="cloud"></span>
	{:else if motif === 'tower'}
		<span class="tower"></span>
	{:else if motif === 'windows'}
		<span class="pane a"></span>
		<span class="pane b"></span>
		<span class="pane c"></span>
		<span class="pane d"></span>
	{:else if motif === 'street'}
		<span class="lamp"></span>
		<span class="ground"></span>
	{:else}
		<span class="ledge"></span>
	{/if}
</div>

<style>
	.shard {
		position: relative;
		height: 100%;
		min-height: 3.2rem;
		width: 100%;
		overflow: hidden;
		background: linear-gradient(180deg, #1e3a5f, #0b1526);
	}

	.moon {
		position: absolute;
		top: 18%;
		right: 22%;
		height: 1.55rem;
		width: 1.55rem;
		border-radius: 999px;
		background: #facc15;
		box-shadow: 0 0 18px 4px color-mix(in srgb, #facc15 55%, transparent);
		animation: pulse 3.6s ease-in-out infinite;
	}

	.star {
		position: absolute;
		height: 0.28rem;
		width: 0.28rem;
		border-radius: 999px;
		background: #bfdbfe;
		animation: twinkle 2.2s ease-in-out infinite;
	}

	.s1 {
		top: 22%;
		left: 24%;
	}
	.s2 {
		top: 38%;
		right: 28%;
		animation-delay: 0.6s;
	}
	.s3 {
		bottom: 30%;
		left: 42%;
		animation-delay: 1.1s;
	}

	.cloud {
		position: absolute;
		top: 34%;
		left: 12%;
		right: 18%;
		height: 0.7rem;
		border-radius: 999px;
		background: color-mix(in srgb, #60a5fa 35%, #1e3a5f);
		animation: drift 5s ease-in-out infinite;
	}

	.tower {
		position: absolute;
		left: 28%;
		right: 32%;
		bottom: 12%;
		height: 62%;
		clip-path: polygon(18% 100%, 18% 28%, 48% 8%, 82% 28%, 82% 100%);
		background: #15253a;
		box-shadow: inset 0 0 0 1px #2a3d5c;
	}

	.pane {
		position: absolute;
		height: 0.55rem;
		width: 0.45rem;
		border-radius: 0.08rem;
		background: #facc15;
		opacity: 0.85;
		animation: blink 2.8s steps(2) infinite;
	}
	.a {
		top: 28%;
		left: 28%;
	}
	.b {
		top: 28%;
		right: 28%;
		animation-delay: 0.4s;
	}
	.c {
		top: 52%;
		left: 28%;
		animation-delay: 0.9s;
	}
	.d {
		top: 52%;
		right: 28%;
		animation-delay: 1.3s;
	}

	.lamp {
		position: absolute;
		left: 46%;
		bottom: 28%;
		height: 1.4rem;
		width: 0.18rem;
		background: #94a3b8;
	}
	.lamp::after {
		content: '';
		position: absolute;
		top: -0.35rem;
		left: 50%;
		height: 0.5rem;
		width: 0.5rem;
		translate: -50% 0;
		border-radius: 999px;
		background: #facc15;
		box-shadow: 0 0 12px 2px color-mix(in srgb, #facc15 50%, transparent);
	}
	.ground {
		position: absolute;
		right: 8%;
		bottom: 16%;
		left: 8%;
		height: 0.28rem;
		border-radius: 999px;
		background: #334155;
	}

	.ledge {
		position: absolute;
		right: 6%;
		bottom: 22%;
		left: 6%;
		height: 0.42rem;
		border-radius: 0.2rem;
		background: #c48a58;
	}

	@keyframes twinkle {
		50% {
			opacity: 0.25;
			transform: scale(0.7);
		}
	}
	@keyframes pulse {
		50% {
			box-shadow: 0 0 26px 8px color-mix(in srgb, #facc15 40%, transparent);
		}
	}
	@keyframes drift {
		50% {
			translate: 12% -8%;
		}
	}
	@keyframes blink {
		50% {
			opacity: 0.35;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.moon,
		.star,
		.cloud,
		.pane {
			animation: none;
		}
	}
</style>

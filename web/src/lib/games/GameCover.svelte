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
	{:else if cover.motif === 'garden'}
		<div class="bed-row"></div>
		<div class="plant-form tomato"></div>
		<div class="plant-form fern"></div>
		<div class="plant-form cactus"></div>
		<div class="plant-form sunflower"></div>
	{:else if cover.motif === 'jet'}
		<div class="jet-trail"></div>
		<div class="jet-body"></div>
		<div class="jet-wing left"></div>
		<div class="jet-wing right"></div>
		<div class="jet-blip a"></div>
		<div class="jet-blip b"></div>
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
	{:else if cover.motif === 'office'}
		<div class="office-build">
			<div class="office-row"></div>
			<div class="office-row"></div>
			<div class="office-row"></div>
			<div class="office-row"></div>
			<div class="office-row"></div>
		</div>
		<div class="office-door"></div>
	{:else if cover.motif === 'ledger'}
		<div class="ledger">
			<div class="ledger-row"></div>
			<div class="ledger-row"></div>
			<div class="ledger-row"></div>
			<div class="ledger-ink"></div>
		</div>
	{:else if cover.motif === 'truck'}
		<div class="haul-road"></div>
		<div class="haul-line"></div>
		<div class="haul-cab"></div>
		<div class="haul-sleeper"></div>
		<div class="haul-box"></div>
		<div class="haul-wheel a"></div>
		<div class="haul-wheel b"></div>
		<div class="haul-wheel c"></div>
		<div class="haul-hill"></div>
	{:else if cover.motif === 'orlamp'}
		<div class="or-lamp"></div>
		<div class="or-cone"></div>
		<div class="or-table"></div>
		<div class="or-drape"></div>
	{:else if cover.motif === 'wok'}
		<div class="wok-flame"></div>
		<div class="wok-pan"></div>
		<div class="wok-handle"></div>
		<div class="wok-steam a"></div>
		<div class="wok-steam b"></div>
	{:else if cover.motif === 'clinic'}
		<div class="clinic-lamp"></div>
		<div class="clinic-cabinet"></div>
		<div class="clinic-shelf a"></div>
		<div class="clinic-shelf b"></div>
		<div class="clinic-jar one"></div>
		<div class="clinic-jar two"></div>
		<div class="clinic-jar three"></div>
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

	.bed-row {
		position: absolute;
		left: 10%;
		right: 10%;
		bottom: 14%;
		height: 22%;
		border-radius: 0.35rem;
		background: color-mix(in srgb, var(--cover-ground) 55%, #7c5a32);
	}

	.plant-form {
		position: absolute;
		bottom: 28%;
	}

	.plant-form.tomato {
		left: 14%;
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 999px;
		background: var(--qx-accent-coral);
		box-shadow: 0 -0.85rem 0 -0.28rem var(--qx-accent-teal);
	}

	.plant-form.fern {
		left: 36%;
		width: 0.35rem;
		height: 1.8rem;
		background: var(--qx-accent-teal);
		border-radius: 0.2rem;
		box-shadow:
			-0.45rem -0.2rem 0 -0.05rem color-mix(in srgb, var(--qx-accent-teal) 70%, white),
			0.45rem 0.1rem 0 -0.05rem color-mix(in srgb, var(--qx-accent-teal) 55%, #166534);
	}

	.plant-form.cactus {
		left: 56%;
		width: 0.7rem;
		height: 1.55rem;
		border-radius: 0.35rem;
		background: color-mix(in srgb, var(--qx-accent-teal) 55%, #166534);
		box-shadow: 0.55rem 0.2rem 0 -0.12rem color-mix(in srgb, var(--qx-accent-teal) 70%, #166534);
	}

	.plant-form.sunflower {
		left: 74%;
		width: 1.35rem;
		height: 1.35rem;
		border-radius: 999px;
		background: var(--qx-accent-gold);
		box-shadow: 0 0.9rem 0 -0.45rem color-mix(in srgb, var(--cover-accent) 55%, #166534);
	}

	.jet-trail {
		position: absolute;
		left: 18%;
		right: 28%;
		top: 46%;
		height: 0.28rem;
		border-radius: 999px;
		background: linear-gradient(
			90deg,
			transparent,
			color-mix(in srgb, var(--qx-accent-gold) 70%, white)
		);
	}

	.jet-body {
		position: absolute;
		left: 42%;
		top: 34%;
		width: 1.15rem;
		height: 2.4rem;
		border-radius: 1rem 1rem 0.3rem 0.3rem;
		background: var(--cover-accent);
	}

	.jet-wing {
		position: absolute;
		top: 52%;
		width: 1.35rem;
		height: 0.45rem;
		background: var(--qx-accent-coral);
		border-radius: 0.2rem;
	}

	.jet-wing.left {
		left: 28%;
	}

	.jet-wing.right {
		right: 26%;
		background: var(--qx-accent-teal);
	}

	.jet-blip {
		position: absolute;
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 0.12rem;
		background: var(--qx-accent-gold);
	}

	.jet-blip.a {
		left: 22%;
		top: 22%;
	}

	.jet-blip.b {
		right: 18%;
		top: 28%;
		background: var(--qx-accent-coral);
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

	.office-build {
		position: absolute;
		left: 22%;
		right: 22%;
		bottom: 16%;
		height: 62%;
		display: grid;
		grid-template-rows: repeat(5, 1fr);
		gap: 0.18rem;
		padding: 0.35rem 0.4rem 0.85rem;
		border-radius: 0.35rem 0.35rem 0.12rem 0.12rem;
		background: color-mix(in srgb, var(--qx-card) 82%, var(--cover-accent));
		box-shadow: 0 10px 24px -16px rgb(15 23 42 / 0.55);
	}

	.office-row {
		background: repeating-linear-gradient(
			90deg,
			color-mix(in srgb, var(--cover-sky) 55%, white) 0 18%,
			transparent 18% 24%
		);
		border-radius: 0.08rem;
	}

	.office-door {
		position: absolute;
		left: 46%;
		bottom: 16%;
		width: 8%;
		height: 10%;
		border-radius: 0.12rem 0.12rem 0 0;
		background: var(--cover-accent);
	}

	.ledger {
		position: absolute;
		left: 16%;
		right: 16%;
		bottom: 16%;
		height: 58%;
		border-radius: 0.35rem;
		background: color-mix(in srgb, #fff8ee 80%, var(--cover-accent));
		box-shadow: 0 10px 24px -16px rgb(15 23 42 / 0.55);
		padding: 0.45rem;
		display: grid;
		grid-template-rows: 1fr 1fr 1fr auto;
		gap: 0.22rem;
	}

	.ledger-row {
		background: repeating-linear-gradient(
			90deg,
			color-mix(in srgb, var(--cover-accent) 35%, white) 0 22%,
			transparent 22% 28%
		);
		border-radius: 0.12rem;
	}

	.ledger-ink {
		height: 0.28rem;
		width: 42%;
		border-radius: 999px;
		background: var(--cover-accent);
	}

	.haul-road {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 12%;
		height: 28%;
		background: color-mix(in srgb, #64748b 70%, var(--cover-ground));
	}

	.haul-line {
		position: absolute;
		left: 8%;
		right: 8%;
		bottom: 24%;
		height: 0.18rem;
		background: repeating-linear-gradient(90deg, #facc15 0 18px, transparent 18px 32px);
	}

	.haul-cab {
		position: absolute;
		left: 22%;
		bottom: 28%;
		width: 1.55rem;
		height: 1.7rem;
		border-radius: 0.25rem 0.35rem 0.12rem 0.12rem;
		background: var(--cover-accent);
		box-shadow: 0.35rem 0.55rem 0 -0.45rem #ffe08a;
	}

	.haul-sleeper {
		position: absolute;
		left: 30%;
		bottom: 28%;
		width: 1.1rem;
		height: 1.35rem;
		background: color-mix(in srgb, var(--cover-accent) 70%, #1e3a8a);
		border-radius: 0.12rem;
	}

	.haul-box {
		position: absolute;
		left: 40%;
		bottom: 30%;
		width: 3.4rem;
		height: 1.55rem;
		border-radius: 0.12rem;
		background: color-mix(in srgb, white 82%, var(--cover-accent));
		box-shadow: inset 0 -0.35rem 0 var(--qx-accent-teal);
	}

	.haul-wheel {
		position: absolute;
		bottom: 22%;
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 999px;
		background: #111827;
	}

	.haul-wheel.a {
		left: 24%;
	}
	.haul-wheel.b {
		left: 44%;
	}
	.haul-wheel.c {
		left: 62%;
	}

	.haul-hill {
		position: absolute;
		right: 6%;
		bottom: 38%;
		width: 28%;
		height: 22%;
		border-radius: 50% 50% 0 0;
		background: color-mix(in srgb, var(--qx-accent-teal) 55%, var(--cover-ground));
	}

	.or-lamp {
		position: absolute;
		left: 38%;
		top: 10%;
		width: 24%;
		height: 12%;
		border-radius: 999px;
		background: color-mix(in srgb, white 70%, var(--cover-accent));
		box-shadow: 0 0.35rem 0 #94a3b8;
	}

	.or-cone {
		position: absolute;
		left: 28%;
		top: 20%;
		width: 44%;
		height: 48%;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--cover-accent) 55%, white),
			transparent 80%
		);
		clip-path: polygon(38% 0, 62% 0, 100% 100%, 0 100%);
		opacity: 0.7;
	}

	.or-table {
		position: absolute;
		left: 16%;
		right: 16%;
		bottom: 16%;
		height: 22%;
		border-radius: 0.4rem;
		background: var(--cover-ground);
	}

	.or-drape {
		position: absolute;
		left: 22%;
		right: 22%;
		bottom: 28%;
		height: 10%;
		border-radius: 0.2rem;
		background: color-mix(in srgb, var(--cover-ground) 70%, white);
	}

	.wok-flame {
		position: absolute;
		left: 32%;
		right: 32%;
		bottom: 18%;
		height: 22%;
		background: linear-gradient(180deg, #ffb020, #e36b2a 55%, transparent);
		clip-path: polygon(42% 0, 58% 0, 88% 100%, 12% 100%);
	}

	.wok-pan {
		position: absolute;
		left: 22%;
		right: 22%;
		bottom: 28%;
		height: 22%;
		border-radius: 50%;
		background: radial-gradient(circle at 40% 35%, #6b6e74, #1f1f22 70%);
		box-shadow: 0 10px 18px -12px rgb(15 23 42 / 0.7);
	}

	.wok-handle {
		position: absolute;
		right: 8%;
		bottom: 36%;
		width: 22%;
		height: 0.38rem;
		border-radius: 999px;
		background: #5a341c;
		transform: rotate(-12deg);
	}

	.wok-steam {
		position: absolute;
		width: 12%;
		height: 16%;
		border-radius: 999px;
		background: color-mix(in srgb, white 55%, transparent);
		bottom: 48%;
	}

	.wok-steam.a {
		left: 38%;
	}

	.clinic-lamp {
		position: absolute;
		left: 42%;
		top: 8%;
		width: 16%;
		height: 18%;
		border-radius: 0.35rem 0.35rem 50% 50%;
		background: color-mix(in srgb, var(--cover-accent) 70%, white);
		box-shadow: 0 0.4rem 0.8rem color-mix(in srgb, var(--cover-accent) 45%, transparent);
	}

	.clinic-cabinet {
		position: absolute;
		left: 18%;
		right: 18%;
		bottom: 12%;
		height: 48%;
		border-radius: 0.35rem;
		background: var(--cover-ground);
		box-shadow: inset 0 0 0 0.18rem color-mix(in srgb, var(--cover-ground) 70%, black);
	}

	.clinic-shelf {
		position: absolute;
		left: 22%;
		right: 22%;
		height: 0.18rem;
		background: color-mix(in srgb, var(--cover-accent) 55%, var(--cover-ground));
	}

	.clinic-shelf.a {
		bottom: 42%;
	}

	.clinic-shelf.b {
		bottom: 28%;
	}

	.clinic-jar {
		position: absolute;
		bottom: 30%;
		width: 10%;
		height: 14%;
		border-radius: 0.2rem 0.2rem 0.45rem 0.45rem;
		background: color-mix(in srgb, var(--cover-accent) 65%, white);
	}

	.clinic-jar.one {
		left: 28%;
	}

	.clinic-jar.two {
		left: 45%;
		background: color-mix(in srgb, #86a373 70%, white);
	}

	.clinic-jar.three {
		left: 62%;
		background: color-mix(in srgb, #c45a4a 55%, white);
	}

	.wok-steam.b {
		left: 52%;
		bottom: 54%;
		width: 9%;
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

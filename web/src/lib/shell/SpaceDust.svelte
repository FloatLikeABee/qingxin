<script lang="ts">
	import { onMount } from 'svelte';
	import {
		createDustField,
		DUST_FRAME_MS,
		shouldAnimateDust,
		stepDust,
		type DustField
	} from './dust';

	let { playView = false }: { playView?: boolean } = $props();

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let cadenceMs = $state(0);

	onMount(() => {
		const canvas = canvasEl;
		if (!canvas || playView) return;
		const ctx = canvas.getContext('2d', { alpha: true });
		if (!ctx) return;

		let field: DustField | null = null;
		let raf = 0;
		let last = 0;
		let acc = 0;
		let frames = 0;
		let frameWindow = 0;
		let cancelled = false;
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		const wash = window.matchMedia('(prefers-reduced-transparency: reduce)');

		const size = () => {
			const w = window.innerWidth || 1;
			const h = window.innerHeight || 1;
			const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
			canvas.width = Math.round(w * dpr);
			canvas.height = Math.round(h * dpr);
			canvas.style.width = `${w}px`;
			canvas.style.height = `${h}px`;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			field = createDustField(11, w, h);
		};

		const paint = () => {
			if (!field) return;
			const w = field.width;
			const h = field.height;
			ctx.clearRect(0, 0, w, h);
			const dark = document.documentElement.classList.contains('dark');
			for (const cloud of field.clouds) {
				const glow = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.r);
				glow.addColorStop(
					0,
					dark ? `rgba(148, 185, 232, ${cloud.a})` : `rgba(96, 140, 196, ${cloud.a * 0.7})`
				);
				glow.addColorStop(1, 'rgba(148, 185, 232, 0)');
				ctx.fillStyle = glow;
				ctx.beginPath();
				ctx.arc(cloud.x, cloud.y, cloud.r, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.fillStyle = dark ? 'rgba(226, 236, 252, 0.82)' : 'rgba(70, 98, 140, 0.5)';
			for (const mote of field.motes) {
				ctx.globalAlpha = mote.a;
				ctx.beginPath();
				ctx.arc(mote.x, mote.y, mote.r, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.globalAlpha = 1;
		};

		const tick = (now: number) => {
			if (cancelled) return;
			const hidden = document.hidden;
			const reduced = motion.matches || wash.matches;
			if (!field) size();
			if (!shouldAnimateDust({ hidden, playView, reducedMotion: reduced })) {
				if (field && cadenceMs === 0) paint();
				canvas.dataset.anim = '0';
				return;
			}
			if (!last) last = now;
			const dt = now - last;
			last = now;
			acc += dt;
			frameWindow += dt;
			if (acc < DUST_FRAME_MS) {
				raf = requestAnimationFrame(tick);
				return;
			}
			const stepped = acc;
			acc = 0;
			field = stepDust(field!, stepped, { reducedMotion: false });
			paint();
			frames += 1;
			if (frameWindow >= 1000) {
				cadenceMs = frameWindow / Math.max(1, frames);
				canvas.dataset.cadence = String(Math.round(cadenceMs));
				frames = 0;
				frameWindow = 0;
			}
			canvas.dataset.anim = '1';
			raf = requestAnimationFrame(tick);
		};

		const start = () => {
			cancelAnimationFrame(raf);
			last = 0;
			acc = 0;
			if (
				shouldAnimateDust({
					hidden: document.hidden,
					playView,
					reducedMotion: motion.matches || wash.matches
				})
			) {
				raf = requestAnimationFrame(tick);
			} else {
				paint();
				canvas.dataset.anim = '0';
			}
		};

		const applyWash = () => {
			canvas.style.display = wash.matches ? 'none' : 'block';
		};
		size();
		applyWash();
		paint();
		start();
		const onResize = () => {
			size();
			paint();
		};
		window.addEventListener('resize', onResize);
		document.addEventListener('visibilitychange', start);
		const onWash = () => {
			applyWash();
			start();
		};
		motion.addEventListener('change', start);
		wash.addEventListener('change', onWash);
		return () => {
			cancelled = true;
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', onResize);
			document.removeEventListener('visibilitychange', start);
			motion.removeEventListener('change', start);
			wash.removeEventListener('change', onWash);
		};
	});
</script>

{#if !playView}
	<canvas bind:this={canvasEl} class="qx-dust" data-qx-dust="1" data-anim="0" aria-hidden="true"
	></canvas>
{/if}

<style>
	.qx-dust {
		position: fixed;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		width: 100%;
		height: 100%;
	}
</style>

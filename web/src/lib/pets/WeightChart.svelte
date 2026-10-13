<script lang="ts">
	import { formatKg } from './weight';
	import type { PetWeight } from './types';

	let { points }: { points: PetWeight[] } = $props();

	const width = 320;
	const height = 160;
	const pad = 18;

	const geometry = $derived.by(() => {
		if (points.length === 0)
			return { line: '', dots: [] as { x: number; y: number; id: string }[] };
		const max = Math.max(1, ...points.map((point) => point.weightG));
		const step = points.length === 1 ? 0 : (width - pad * 2) / (points.length - 1);
		const dots = points.map((point, index) => {
			const x = pad + index * (step || 0);
			const y = height - pad - (point.weightG / max) * (height - pad * 2);
			return { x, y, id: point.id };
		});
		const line = dots
			.map(
				(point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`
			)
			.join(' ');
		return { line, dots };
	});
</script>

{#if points.length === 0}
	<p class="text-base text-[var(--qx-muted)]">还没有体重记录。</p>
{:else}
	<svg class="h-44 w-full" viewBox="0 0 {width} {height}" role="img" aria-label="体重曲线">
		<line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--qx-line)" />
		{#if geometry.line}
			<path
				d={geometry.line}
				fill="none"
				stroke="var(--qx-chart-1)"
				stroke-width="3"
				stroke-linecap="round"
			/>
		{/if}
		{#each geometry.dots as point (point.id)}
			<circle cx={point.x} cy={point.y} r="4" fill="var(--qx-chart-1)" />
		{/each}
	</svg>
	<p class="text-sm text-[var(--qx-muted)]">
		最近 {formatKg(points[points.length - 1]?.weightG ?? 0)}
	</p>
{/if}

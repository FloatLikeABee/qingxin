<script lang="ts">
	import type { TrendPoint } from './trends';

	let { points }: { points: TrendPoint[] } = $props();

	const width = 320;
	const height = 160;
	const pad = 18;

	const geometry = $derived.by(() => {
		if (points.length === 0) return { line: '', area: '' };
		const max = Math.max(5, ...points.map((point) => point.averageScore));
		const step = points.length === 1 ? 0 : (width - pad * 2) / (points.length - 1);
		const coords = points.map((point, index) => {
			const x = pad + index * (step || 0);
			const y = height - pad - (point.averageScore / max) * (height - pad * 2);
			return { x, y };
		});
		const line = coords
			.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
			.join(' ');
		const first = coords[0];
		const last = coords[coords.length - 1];
		const area = first && last
			? `${line} L${last.x.toFixed(1)},${height - pad} L${first.x.toFixed(1)},${height - pad} Z`
			: '';
		return { line, area };
	});
</script>

<svg
	class="h-44 w-full"
	viewBox="0 0 {width} {height}"
	role="img"
	aria-label="心情趋势"
>
	<defs>
		<linearGradient id="qx-mood-line" x1="0" y1="0" x2="1" y2="0">
			<stop offset="0%" stop-color="var(--qx-chart-1)" />
			<stop offset="100%" stop-color="var(--qx-chart-2)" />
		</linearGradient>
		<linearGradient id="qx-mood-fill" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color="var(--qx-chart-2)" stop-opacity="0.35" />
			<stop offset="100%" stop-color="var(--qx-chart-2)" stop-opacity="0" />
		</linearGradient>
	</defs>
	<line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--qx-line)" />
	{#if geometry.area}
		<path d={geometry.area} fill="url(#qx-mood-fill)" />
	{/if}
	{#if geometry.line}
		<path d={geometry.line} fill="none" stroke="url(#qx-mood-line)" stroke-width="3" stroke-linecap="round" />
	{/if}
	{#each points as point, index (point.date)}
		{@const max = Math.max(5, ...points.map((item) => item.averageScore))}
		{@const step = points.length === 1 ? 0 : (width - pad * 2) / (points.length - 1)}
		{@const x = pad + index * (step || 0)}
		{@const y = height - pad - (point.averageScore / max) * (height - pad * 2)}
		<circle cx={x} cy={y} r="4" fill="var(--qx-chart-1)" />
	{/each}
</svg>

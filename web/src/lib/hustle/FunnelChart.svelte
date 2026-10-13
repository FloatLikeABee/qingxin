<script lang="ts">
	import type { FunnelStage } from './funnel';

	let { stages }: { stages: FunnelStage[] } = $props();

	const width = 320;
	const height = 150;
	const max = $derived(Math.max(1, ...stages.map((item) => item.count)));
	const fills = ['var(--qx-chart-1)', 'var(--qx-chart-2)', 'var(--qx-chart-3)'];
</script>

<svg class="h-40 w-full" viewBox="0 0 {width} {height}" role="img" aria-label="求职漏斗">
	{#each stages as stage, index (stage.status)}
		{@const barWidth = 80 + (stage.count / max) * 180}
		{@const x = (width - barWidth) / 2}
		{@const y = 22 + index * 40}
		<rect
			{x}
			{y}
			width={barWidth}
			height="28"
			rx="10"
			fill={fills[index] ?? fills[0]}
			opacity="0.85"
		/>
		<text x={width / 2} y={y + 19} text-anchor="middle" fill="white" font-size="13"
			>{stage.status} {stage.count}</text
		>
	{/each}
</svg>

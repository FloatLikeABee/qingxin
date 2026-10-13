<script lang="ts">
	import { FINANCE_TOKENS } from './colours';
	import { pieSlicePath } from './pie';

	let {
		slices
	}: {
		slices: { label: string; value: number }[];
	} = $props();

	const palette = [FINANCE_TOKENS.expense, '#F59E0B', '#3B82F6', '#8B5CF6', '#14B8A6', '#EC4899'];
	const total = $derived(slices.reduce((sum, item) => sum + item.value, 0));
	const paths = $derived.by(() => {
		if (total <= 0) return [];
		let angle = -Math.PI / 2;
		return slices.map((slice, index) => {
			const sweep = (slice.value / total) * Math.PI * 2;
			const start = angle;
			angle += sweep;
			return {
				label: slice.label,
				d: pieSlicePath(start, sweep),
				fill: palette[index % palette.length]
			};
		});
	});
</script>

{#if total <= 0}
	<p class="text-base text-[var(--qx-muted)]">这个月还没有支出。</p>
{:else}
	<svg viewBox="0 0 100 100" class="mx-auto h-48 w-48" role="img" aria-label="分类占比">
		{#each paths as slice (slice.label)}
			<path d={slice.d} fill={slice.fill} />
		{/each}
	</svg>
	<ul class="mt-3 space-y-1 text-base">
		{#each slices as slice, index (slice.label)}
			<li class="flex justify-between">
				<span>
					<span
						class="mr-2 inline-block h-2.5 w-2.5 rounded-full"
						style="background:{palette[index % palette.length]}"
					></span>
					{slice.label}
				</span>
				<span>{Math.round((slice.value / total) * 100)}%</span>
			</li>
		{/each}
	</ul>
{/if}

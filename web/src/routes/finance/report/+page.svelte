<script lang="ts">
	import { browser } from '$app/env';
	import Card from '#lib/components/Card.svelte';
	import PieChart from '#lib/finance/PieChart.svelte';
	import { amountTone } from '#lib/finance/colours';
	import { currentMonth, formatYuanLabel } from '#lib/finance/money';
	import { getFinanceStore } from '#lib/finance/store';

	const store = getFinanceStore();
	const month = currentMonth();
	let report = $state(store.report(month));

	$effect(() => {
		if (!browser) return;
		void store.hydrate().then(() => {
			report = store.report(month);
		});
	});
</script>

<svelte:head>
	<title>轻心 · 财务报表</title>
</svelte:head>

<Card>
	<h1 class="text-2xl font-semibold">{month} 分类占比</h1>
	<div class="mt-4">
		<PieChart
			slices={report.slices.map((item) => ({ label: item.categoryName, value: item.amountFen }))}
		/>
	</div>
</Card>

<Card>
	<h2 class="text-lg font-semibold">趋势</h2>
	<p class="mt-3 text-base">
		环比支出
		<span class={amountTone('expense')}>{formatYuanLabel(report.mom.expenseDeltaFen)}</span>
	</p>
	<p class="mt-2 text-base">
		同比支出
		<span class={amountTone('expense')}>{formatYuanLabel(report.yoy.expenseDeltaFen)}</span>
	</p>
</Card>

<p class="text-base text-[var(--qx-muted)]">仅为记账工具，不构成理财建议</p>

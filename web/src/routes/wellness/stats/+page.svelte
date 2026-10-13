<script lang="ts">
	import { browser } from '$app/env';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Disclaimer from '#lib/wellness/Disclaimer.svelte';
	import { getWellnessStore } from '#lib/wellness/store';
	import type { SleepLog } from '#lib/wellness/types';

	const store = getWellnessStore();
	let waterByDay = $state<[string, number][]>([]);
	let sleep = $state<SleepLog[]>([]);

	function refresh() {
		waterByDay = [
			...store.water.reduce((map, row) => {
				map.set(row.loggedOn, (map.get(row.loggedOn) ?? 0) + row.ml);
				return map;
			}, new Map<string, number>())
		].sort((a, b) => b[0].localeCompare(a[0]));
		sleep = [...store.sleep];
	}

	$effect(() => {
		if (!browser) return;
		void store.hydrate().then(refresh);
	});
</script>

<svelte:head>
	<title>轻心 · 健康统计</title>
</svelte:head>

<Card>
	<h1 class="text-2xl font-semibold">统计</h1>
	<Disclaimer />
</Card>

<Card>
	<h2 class="text-lg font-semibold">喝水</h2>
	{#if waterByDay.length === 0}
		<EmptyState title="还没有喝水记录" body="在今日页点 +1 杯。" />
	{:else}
		<ul class="mt-3 divide-y divide-[var(--qx-line)]">
			{#each waterByDay as [day, ml] (day)}
				<li class="flex min-h-11 items-center justify-between py-2 text-base">
					<span>{day}</span>
					<span>{ml} ml</span>
				</li>
			{/each}
		</ul>
	{/if}
</Card>

<Card>
	<h2 class="text-lg font-semibold">睡眠质量</h2>
	{#if sleep.length === 0}
		<p class="mt-2 text-base text-[var(--qx-muted)]">还没有睡眠打卡。</p>
	{:else}
		<ul class="mt-3 space-y-2">
			{#each sleep as row (row.id)}
				<li class="rounded-2xl bg-[var(--qx-surface)] px-4 py-3 text-base">
					质量 {row.quality}/5
					{#if row.note}
						· {row.note}
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</Card>

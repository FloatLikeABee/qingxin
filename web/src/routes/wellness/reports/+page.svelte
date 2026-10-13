<script lang="ts">
	import { browser } from '$app/env';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Input from '#lib/components/Input.svelte';
	import Disclaimer from '#lib/wellness/Disclaimer.svelte';
	import { getWellnessStore } from '#lib/wellness/store';
	import { shanghaiToday } from '#lib/wellness/water';
	import type { ReportLog } from '#lib/wellness/types';

	const store = getWellnessStore();
	let title = $state('体检');
	let reportDate = $state(shanghaiToday());
	let name = $state('血压');
	let value = $state('120/80');
	let unit = $state('mmHg');
	let reports = $state<ReportLog[]>([]);

	$effect(() => {
		if (!browser) return;
		void store.hydrate().then(() => {
			reports = [...store.reports];
		});
	});

	async function save() {
		await store.addReport({
			title,
			reportDate,
			metrics: [{ name, value, unit }]
		});
		reports = [...store.reports];
	}
</script>

<svelte:head>
	<title>轻心 · 体检指标</title>
</svelte:head>

<Card>
	<h1 class="text-2xl font-semibold">报告指标</h1>
	<p class="mt-2 text-base text-[var(--qx-muted)]">v1 只保存关键指标，不上传文件。</p>
	<Disclaimer extra="OCR 结果需你确认，且标为待确认。" />
</Card>

<Card>
	<Input label="标题" bind:value={title} />
	<Input label="日期" type="date" bind:value={reportDate} class="mt-3" />
	<Input label="指标名" bind:value={name} class="mt-3" />
	<Input label="数值" bind:value class="mt-3" />
	<Input label="单位" bind:value={unit} class="mt-3" />
	<Button class="mt-4 w-full" onclick={save}>保存指标</Button>
</Card>

<Card>
	<h2 class="text-lg font-semibold">已存</h2>
	{#if reports.length === 0}
		<EmptyState title="还没有指标" body="粘贴或手填关键数字即可。" />
	{:else}
		<ul class="mt-3 space-y-3">
			{#each reports as row (row.id)}
				<li class="rounded-2xl bg-[var(--qx-surface)] p-4">
					<p class="text-base font-medium">{row.title} · {row.reportDate}</p>
					{#each row.metrics as metric, i (`${row.id}-${i}`)}
						<p class="text-base text-[var(--qx-muted)]">
							{metric.name}
							{metric.value}{metric.unit ? ` ${metric.unit}` : ''}
						</p>
					{/each}
				</li>
			{/each}
		</ul>
	{/if}
</Card>

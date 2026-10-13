<script lang="ts">
	import { browser } from '$app/env';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import Input from '#lib/components/Input.svelte';
	import { fenFromYuanInput, formatYuanLabel, todayIso } from '#lib/finance/money';
	import { getFinanceStore } from '#lib/finance/store';
	import type { SubCycle } from '#lib/finance/types';

	const store = getFinanceStore();
	let limitYuan = $state('1000');
	let categoryId = $state(store.categories.find((item) => item.kind === 'expense')?.id ?? '');
	let subName = $state('音乐会员');
	let subYuan = $state('30');
	let cycle = $state<SubCycle>('monthly');
	let tick = $state(0);

	$effect(() => {
		if (!browser) return;
		void store.hydrate().then(() => {
			tick += 1;
		});
	});

	async function saveBudget() {
		const fen = fenFromYuanInput(limitYuan);
		if (!fen) return;
		await store.upsertBudget({
			categoryId,
			monthlyLimitFen: fen,
			alertThresholdPct: 80
		});
		tick += 1;
	}

	async function saveSub() {
		const fen = fenFromYuanInput(subYuan);
		if (!fen || !subName.trim()) return;
		const next = new Date(`${todayIso()}T00:00:00Z`);
		next.setUTCDate(next.getUTCDate() + 2);
		await store.createSubscription({
			name: subName.trim(),
			priceFen: fen,
			cycle,
			nextBillingDate: next.toISOString().slice(0, 10),
			remindDaysBefore: 3
		});
		tick += 1;
	}
</script>

<svelte:head>
	<title>轻心 · 财务设置</title>
</svelte:head>

<Card>
	<h1 class="text-2xl font-semibold">预算</h1>
	<label class="mt-4 block text-base">
		分类
		<select
			class="mt-2 min-h-11 w-full rounded-2xl border border-[var(--qx-line)] bg-[var(--qx-bg)] px-3"
			bind:value={categoryId}
		>
			{#each store.categories.filter((item) => item.kind === 'expense') as item (item.id)}
				<option value={item.id}>{item.name}</option>
			{/each}
		</select>
	</label>
	<Input label="每月限额（元）" bind:value={limitYuan} inputmode="decimal" />
	<Button class="mt-4 w-full" onclick={saveBudget}>保存预算</Button>
	{#key tick}
		<ul class="mt-4 space-y-2 text-base">
			{#each store.budgets as budget (budget.id)}
				<li class="flex justify-between">
					<span>{budget.categoryName}</span>
					<span>{formatYuanLabel(budget.monthlyLimitFen)}</span>
				</li>
			{/each}
		</ul>
	{/key}
</Card>

<Card>
	<h2 class="text-lg font-semibold">订阅</h2>
	<Input label="名称" bind:value={subName} />
	<Input label="价格（元）" bind:value={subYuan} inputmode="decimal" />
	<label class="mt-3 block text-base">
		周期
		<select
			class="mt-2 min-h-11 w-full rounded-2xl border border-[var(--qx-line)] bg-[var(--qx-bg)] px-3"
			bind:value={cycle}
		>
			<option value="weekly">每周</option>
			<option value="monthly">每月</option>
			<option value="quarterly">每季</option>
			<option value="yearly">每年</option>
		</select>
	</label>
	<Button class="mt-4 w-full" onclick={saveSub}>添加订阅</Button>
	{#key tick}
		<p class="mt-3 text-base text-[var(--qx-muted)]">
			年费合计 {formatYuanLabel(
				store.subscriptions.reduce((sum, item) => sum + item.annualCostFen, 0)
			)}
		</p>
		<ul class="mt-3 space-y-2 text-base">
			{#each store.subscriptions as item (item.id)}
				<li class="flex min-h-11 items-center justify-between">
					<span>{item.name} · {item.nextBillingDate}</span>
					<span>{formatYuanLabel(item.annualCostFen)} / 年</span>
				</li>
			{/each}
		</ul>
	{/key}
</Card>

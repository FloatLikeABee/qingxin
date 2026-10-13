<script lang="ts">
	import { browser } from '$app/env';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import { amountTone } from '#lib/finance/colours';
	import { currentMonth, formatYuanLabel } from '#lib/finance/money';
	import { getFinanceStore } from '#lib/finance/store';

	const store = getFinanceStore();
	let month = $state(currentMonth());
	let summary = $state(store.summary(month));
	let upcoming = $state(store.upcoming());

	$effect(() => {
		if (!browser) return;
		void store.hydrate().then(() => {
			summary = store.summary(month);
			upcoming = store.upcoming();
		});
	});
</script>

<svelte:head>
	<title>轻心 · 财务</title>
</svelte:head>

<div>
	<p class="text-base text-[var(--qx-muted)]">{month} 本月结余</p>
	<p
		class="mt-1 font-[Outfit] text-5xl font-semibold {summary.balanceFen >= 0
			? amountTone('income')
			: amountTone('expense')}"
	>
		{formatYuanLabel(summary.balanceFen)}
	</p>
	<p class="mt-2 text-base text-[var(--qx-muted)]">
		收入 {formatYuanLabel(summary.incomeFen)} · 支出 {formatYuanLabel(summary.expenseFen)}
	</p>
</div>

{#if upcoming.length}
	<Card>
		<h2 class="text-lg font-semibold">续费提醒</h2>
		<ul class="mt-3 space-y-2">
			{#each upcoming as item (item.id)}
				<li class="flex min-h-11 items-center justify-between text-base">
					<span>{item.name}</span>
					<span class={amountTone('expense')}>{formatYuanLabel(item.priceFen)}</span>
				</li>
			{/each}
		</ul>
	</Card>
{/if}

<Card>
	<h2 class="text-lg font-semibold">预算进度</h2>
	{#if summary.budgets.length === 0}
		<p class="mt-2 text-base text-[var(--qx-muted)]">到设置页加一个分类预算。</p>
	{:else}
		<ul class="mt-4 space-y-4">
			{#each summary.budgets as budget (budget.id)}
				<li>
					<div class="flex justify-between text-base">
						<span>{budget.categoryName ?? '总预算'}</span>
						<span class={budget.alert ? amountTone('expense') : ''}>{budget.pct ?? 0}%</span>
					</div>
					<div class="mt-2 h-3 overflow-hidden rounded-full bg-[var(--qx-surface)]">
						<div
							class="h-full rounded-full {budget.alert
								? 'bg-[var(--qx-expense)]'
								: 'bg-[var(--qx-primary)]'}"
							style="width: {Math.min(budget.pct ?? 0, 100)}%"
						></div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</Card>

<Card>
	<h2 class="text-lg font-semibold">最近 5 笔</h2>
	{#if summary.recent.length === 0}
		<EmptyState title="还没有流水" body="三步记一笔：金额、分类、确认。" icon="spark" />
	{:else}
		<ul class="mt-3 divide-y divide-[var(--qx-line)]">
			{#each summary.recent as item (item.id)}
				<li class="flex min-h-14 items-center justify-between py-2">
					<div>
						<p class="text-base font-medium">{item.categoryName}</p>
						<p class="text-sm text-[var(--qx-muted)]">
							{item.occurredOn}{item.note ? ` · ${item.note}` : ''}
						</p>
					</div>
					<p class="text-lg font-semibold {amountTone(item.type)}">
						{item.type === 'expense' ? '-' : '+'}{formatYuanLabel(item.amountFen)}
					</p>
				</li>
			{/each}
		</ul>
	{/if}
</Card>

<Button href="/finance/add" class="w-full">记一笔</Button>

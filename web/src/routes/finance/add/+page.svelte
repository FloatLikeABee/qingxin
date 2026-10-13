<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import { confirmEntry, createEntry, selectCategory, typeDigit } from '#lib/finance/entry';
	import Keypad from '#lib/finance/Keypad.svelte';
	import { displayYuan, todayIso } from '#lib/finance/money';
	import { getFinanceStore } from '#lib/finance/store';

	const store = getFinanceStore();
	let entry = $state(createEntry('expense'));
	let pending = $state(false);

	const categories = $derived(store.categories.filter((item) => item.kind === entry.type));

	function onkey(key: string) {
		entry = typeDigit(entry, key);
	}

	async function confirm() {
		const done = confirmEntry({ ...entry, category: entry.category });
		if (!done) return;
		pending = true;
		try {
			await store.addTransaction({
				amountFen: done.amountFen,
				type: done.type,
				categoryId: done.category!.id,
				note: done.note,
				occurredOn: todayIso(),
				clientId: crypto.randomUUID()
			});
			await goto('/finance');
		} finally {
			pending = false;
		}
	}
</script>

<svelte:head>
	<title>轻心 · 记账</title>
</svelte:head>

<Card>
	<div class="mb-4 flex gap-2">
		{#each ['expense', 'income'] as kind (kind)}
			<button
				type="button"
				class="min-h-11 flex-1 rounded-2xl text-base {entry.type === kind
					? kind === 'expense'
						? 'bg-[var(--qx-expense)] text-white'
						: 'bg-[var(--qx-income)] text-white'
					: 'bg-[var(--qx-surface)]'}"
				onclick={() => (entry = createEntry(kind === 'income' ? 'income' : 'expense'))}
			>
				{kind === 'expense' ? '支出' : '收入'}
			</button>
		{/each}
	</div>
	<p class="mb-4 text-center font-[Outfit] text-5xl font-semibold">¥{displayYuan(entry.digits)}</p>
	<p class="mb-3 text-center text-base text-[var(--qx-muted)]">
		{entry.step === 'amount'
			? '1 / 3 输入金额'
			: entry.step === 'confirm'
				? '3 / 3 确认'
				: '2 / 3 选择分类'}
	</p>
	<Keypad value={entry.digits} {onkey} />
	<Button
		class="mt-4 w-full"
		disabled={!entry.digits}
		onclick={() => (entry = { ...entry, step: 'category' })}
	>
		下一步：选分类
	</Button>
</Card>

{#if entry.step !== 'amount'}
	<Card>
		<h2 class="mb-3 text-lg font-semibold">常用分类</h2>
		<div class="grid grid-cols-4 gap-2">
			{#each categories as category (category.id)}
				<button
					type="button"
					class="min-h-14 rounded-2xl bg-[var(--qx-surface)] text-sm {entry.category?.id ===
					category.id
						? 'ring-2 ring-[var(--qx-primary)]'
						: ''}"
					onclick={() => (entry = selectCategory(entry, category))}
				>
					{category.name}
				</button>
			{/each}
		</div>
		<Button class="mt-4 w-full" disabled={!entry.category || pending} onclick={confirm}>
			确认记账
		</Button>
	</Card>
{/if}

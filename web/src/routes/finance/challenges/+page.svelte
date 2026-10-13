<script lang="ts">
	import { browser } from '$app/env';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import Input from '#lib/components/Input.svelte';
	import { todayIso } from '#lib/finance/money';
	import { getFinanceStore } from '#lib/finance/store';

	const store = getFinanceStore();
	let name = $state('不买奶茶 30 天');
	let days = $state('30');
	let tick = $state(0);

	$effect(() => {
		if (!browser) return;
		void store.hydrate().then(() => {
			tick += 1;
		});
	});

	async function create() {
		const targetDays = Number(days);
		if (!name.trim() || !Number.isFinite(targetDays) || targetDays <= 0) return;
		await store.createChallenge({ name: name.trim(), targetDays, startDate: todayIso() });
		tick += 1;
	}

	async function checkin(id: string) {
		await store.checkin(id, todayIso());
		tick += 1;
	}
</script>

<svelte:head>
	<title>轻心 · 省钱挑战</title>
</svelte:head>

<Card>
	<h1 class="text-2xl font-semibold">省钱挑战</h1>
	<p class="mt-2 text-base text-[var(--qx-muted)]">每天手动打卡，不自动根据消费判失败。</p>
	<Input label="名称" bind:value={name} />
	<Input label="目标天数" bind:value={days} inputmode="numeric" />
	<Button class="mt-4 w-full" onclick={create}>开始挑战</Button>
</Card>

{#key tick}
	{#each store.challenges as item (item.id)}
		<Card>
			<div class="flex items-center justify-between">
				<h2 class="text-lg font-semibold">{item.name}</h2>
				<p class="text-base">{item.progressDays}/{item.targetDays}</p>
			</div>
			<div class="mt-3 h-3 overflow-hidden rounded-full bg-[var(--qx-surface)]">
				<div
					class="h-full rounded-full bg-[var(--qx-income)]"
					style="width: {Math.min((item.progressDays / item.targetDays) * 100, 100)}%"
				></div>
			</div>
			<Button class="mt-4 w-full" onclick={() => checkin(item.id)}>今日打卡</Button>
		</Card>
	{/each}
{/key}

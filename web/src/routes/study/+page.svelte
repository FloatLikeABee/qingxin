<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Disclaimer from '#lib/study/Disclaimer.svelte';
	import Flame from '#lib/study/Flame.svelte';
	import { getStudyStore } from '#lib/study/store';
	import { pushToast } from '#lib/toast';

	const store = getStudyStore();
	const snapshot = $derived(store.today());

	onMount(() => {
		void store.load().catch((error) => {
			pushToast({ title: '无法加载学习', body: String(error), tone: 'danger' });
		});
	});
</script>

<svelte:head>
	<title>轻心 · 学习打卡</title>
</svelte:head>

<Card>
	<h1 class="text-2xl font-semibold">今日任务</h1>
	<p class="mt-2 text-base text-[var(--qx-muted)]">
		{snapshot.date} · 待复习 {snapshot.dueFlashcards} 张
	</p>
</Card>

{#if snapshot.challenges.length === 0}
	<Card>
		<EmptyState
			title="还没有挑战"
			body="开一个 7 / 14 / 21 天打卡营，看见自己的连续。"
			icon="spark"
		>
			{#snippet action()}
				<Button href="/study/checkin">开始打卡</Button>
			{/snippet}
		</EmptyState>
	</Card>
{:else}
	{#each snapshot.challenges as item (item.id)}
		<Card>
			<div class="flex items-center justify-between gap-3">
				<h2 class="text-lg font-semibold">{item.name}</h2>
				<Flame streak={item.currentStreak} />
			</div>
			<p class="mt-2 text-base text-[var(--qx-muted)]">
				{item.progressDays}/{item.targetDays} 天 · {item.checkedInToday
					? '今日已打卡'
					: '今日未打卡'}
			</p>
			<div class="mt-3 h-3 overflow-hidden rounded-full bg-[var(--qx-surface)]">
				<div
					class="h-full rounded-full bg-[var(--qx-primary)]"
					style="width: {Math.min((item.progressDays / item.targetDays) * 100, 100)}%"
				></div>
			</div>
			<Button href="/study/checkin" class="mt-4 w-full">完成今日任务</Button>
		</Card>
	{/each}
{/if}

<Disclaimer />

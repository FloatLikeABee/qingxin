<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Input from '#lib/components/Input.svelte';
	import Disclaimer from '#lib/study/Disclaimer.svelte';
	import { getStudyStore } from '#lib/study/store';
	import type { Grade } from '#lib/study/review';
	import { pushToast } from '#lib/toast';

	const store = getStudyStore();
	let front = $state('');
	let back = $state('');

	onMount(() => {
		void store.load();
	});

	async function add() {
		if (!front.trim() || !back.trim()) return;
		try {
			await store.addCard({ front: front.trim(), back: back.trim() });
			front = '';
			back = '';
		} catch (error) {
			pushToast({ title: '没有保存', body: String(error), tone: 'danger' });
		}
	}

	async function grade(id: string, value: Grade) {
		try {
			await store.review(id, value);
		} catch (error) {
			pushToast({ title: '复习失败', body: String(error), tone: 'danger' });
		}
	}
</script>

<svelte:head>
	<title>轻心 · 错题本</title>
</svelte:head>

<Card>
	<h1 class="text-2xl font-semibold">错题本</h1>
	<p class="mt-2 text-base text-[var(--qx-muted)]">只支持文本录入，照片以后再说。</p>
	<Input label="正面" bind:value={front} />
	<Input label="背面" bind:value={back} />
	<Button class="mt-4 w-full" onclick={add}>加入卡片</Button>
</Card>

{#if store.cards.length === 0}
	<Card>
		<EmptyState title="还没有卡片" body="把容易忘的词或题记在这里，到期再翻。" icon="spark" />
	</Card>
{:else}
	{#each store.cards as item (item.id)}
		<Card>
			<p class="text-lg font-semibold">{item.front}</p>
			<p class="mt-2 text-base text-[var(--qx-muted)]">{item.back}</p>
			<p class="mt-2 text-sm text-[var(--qx-muted)]">
				下次 {item.nextReviewDate} · 间隔 {item.intervalDays} 天
			</p>
			<div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
				<Button variant="secondary" onclick={() => grade(item.id, 'again')}>重来</Button>
				<Button variant="secondary" onclick={() => grade(item.id, 'hard')}>较难</Button>
				<Button onclick={() => grade(item.id, 'good')}>记得</Button>
				<Button variant="ghost" onclick={() => grade(item.id, 'easy')}>简单</Button>
			</div>
		</Card>
	{/each}
{/if}

<Disclaimer />

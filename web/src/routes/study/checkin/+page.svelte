<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import Input from '#lib/components/Input.svelte';
	import Disclaimer from '#lib/study/Disclaimer.svelte';
	import Flame from '#lib/study/Flame.svelte';
	import { TARGET_DAYS, type TargetDays } from '#lib/study/disclaimer';
	import { getStudyStore } from '#lib/study/store';
	import { pushToast } from '#lib/toast';

	const store = getStudyStore();
	let name = $state('背单词');
	let days = $state<TargetDays>(21);
	let busy = $state(false);
	let ready = $state(false);

	onMount(() => {
		void store.load().finally(() => {
			ready = true;
		});
	});

	async function create() {
		if (!name.trim() || busy) return;
		busy = true;
		try {
			await store.createChallenge({ name: name.trim(), targetDays: days });
		} catch (error) {
			pushToast({ title: '没有保存', body: String(error), tone: 'danger' });
		} finally {
			busy = false;
		}
	}

	async function checkin(id: string) {
		try {
			await store.checkin(id);
		} catch (error) {
			pushToast({ title: '打卡失败', body: String(error), tone: 'danger' });
		}
	}
</script>

<svelte:head>
	<title>轻心 · 完成今日任务</title>
</svelte:head>

<Card>
	<h1 class="text-2xl font-semibold">打卡营</h1>
	<p class="mt-2 text-base text-[var(--qx-muted)]">7 / 14 / 21 天，每天最多打一次。</p>
	<Input label="名称" bind:value={name} />
	<div class="mt-3 grid grid-cols-3 gap-2">
		{#each TARGET_DAYS as option (option)}
			<Button variant={days === option ? 'primary' : 'secondary'} onclick={() => (days = option)}
				>{option} 天</Button
			>
		{/each}
	</div>
	<Button class="mt-4 w-full" onclick={create} disabled={busy || !ready}>开始挑战</Button>
</Card>

{#each store.challenges as item (item.id)}
	<Card>
		<div class="flex items-center justify-between gap-3">
			<h2 class="text-lg font-semibold">{item.name}</h2>
			<Flame streak={item.currentStreak} />
		</div>
		<Button class="mt-4 w-full" onclick={() => checkin(item.id)}>
			{item.checkedInToday ? '今日已完成' : '完成今日任务'}
		</Button>
	</Card>
{/each}

<Disclaimer />

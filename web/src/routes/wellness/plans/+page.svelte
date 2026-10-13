<script lang="ts">
	import { browser } from '$app/env';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Disclaimer from '#lib/wellness/Disclaimer.svelte';
	import { getWellnessStore } from '#lib/wellness/store';
	import { shanghaiToday } from '#lib/wellness/water';
	import type { PlanLog } from '#lib/wellness/types';

	const store = getWellnessStore();
	const today = shanghaiToday();
	let plans = $state<PlanLog[]>([]);

	function refresh() {
		plans = [...store.plans];
	}

	$effect(() => {
		if (!browser) return;
		void store.hydrate().then(refresh);
	});

	async function start(kind: 'water_21' | 'sleep_21') {
		await store.createPlan(kind);
		refresh();
	}

	async function checkin(id: string) {
		await store.checkin(id, today);
		refresh();
	}
</script>

<svelte:head>
	<title>轻心 · 健康计划</title>
</svelte:head>

<Card>
	<h1 class="text-2xl font-semibold">21 天计划</h1>
	<Disclaimer />
	<div class="mt-4 grid gap-3 sm:grid-cols-2">
		<Button onclick={() => start('water_21')}>开始喝水挑战</Button>
		<Button variant="secondary" onclick={() => start('sleep_21')}>开始睡眠打卡</Button>
	</div>
</Card>

{#if plans.length === 0}
	<EmptyState title="还没有计划" body="选一个 21 天微习惯。" />
{:else}
	{#each plans as plan (plan.id)}
		<Card>
			<h2 class="text-lg font-semibold">{plan.title}</h2>
			<p class="mt-2 text-base text-[var(--qx-muted)]">
				{plan.progressDays} / {plan.targetDays} 天
			</p>
			<div class="mt-3 h-3 overflow-hidden rounded-full bg-[var(--qx-surface)]">
				<div
					class="h-full rounded-full bg-[var(--qx-primary)]"
					style="width: {Math.min((plan.progressDays * 100) / plan.targetDays, 100)}%"
				></div>
			</div>
			<Button class="mt-4 w-full" onclick={() => checkin(plan.id)}>完成今日</Button>
		</Card>
	{/each}
{/if}

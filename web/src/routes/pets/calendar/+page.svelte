<script lang="ts">
	import Card from '#lib/components/Card.svelte';
	import DisclaimerBanner from '#lib/pets/DisclaimerBanner.svelte';
	import { calendarMarks, currentMonth, monthGrid, shiftMonth } from '#lib/pets/calendar';
	import { getPetsStore } from '#lib/pets/store';
	import { RECORD_LABEL } from '#lib/pets/types';

	const store = getPetsStore();
	let month = $state(currentMonth());
	const days = $derived(monthGrid(month));
	const marks = $derived(calendarMarks(month, store.records, store.weights));
	const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
</script>

<svelte:head>
	<title>轻心 · 宠物日历</title>
</svelte:head>

<h1 class="text-3xl font-semibold">健康日历</h1>
<DisclaimerBanner />

<Card>
	<div class="flex items-center justify-between">
		<button
			type="button"
			class="inline-flex min-h-11 items-center rounded-2xl bg-[var(--qx-surface)] px-4 text-base"
			onclick={() => (month = shiftMonth(month, -1))}>上月</button
		>
		<p class="text-lg font-semibold">{month}</p>
		<button
			type="button"
			class="inline-flex min-h-11 items-center rounded-2xl bg-[var(--qx-surface)] px-4 text-base"
			onclick={() => (month = shiftMonth(month, 1))}>下月</button
		>
	</div>
	<div class="mt-4 grid grid-cols-7 gap-1 text-center text-sm text-[var(--qx-muted)]">
		{#each weekdays as day (day)}
			<span>{day}</span>
		{/each}
	</div>
	<div class="mt-1 grid grid-cols-7 gap-1">
		{#each days as day (day.date)}
			<div
				class="min-h-14 rounded-xl px-1 py-2 text-sm {day.inMonth
					? 'bg-[var(--qx-surface)] text-[var(--qx-text)]'
					: 'text-[var(--qx-muted)]'}"
			>
				<span>{day.date.slice(8)}</span>
				{#if marks[day.date]?.length}
					<p class="mt-1 text-xs text-[var(--qx-primary)]">
						{marks[day.date]
							?.map((tag) =>
								tag === 'due'
									? '到期'
									: tag === 'weight'
										? '体重'
										: (RECORD_LABEL[tag as keyof typeof RECORD_LABEL] ?? tag)
							)
							.join(' ')}
					</p>
				{/if}
			</div>
		{/each}
	</div>
</Card>

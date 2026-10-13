<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import Disclaimer from '#lib/wellness/Disclaimer.svelte';
	import Ring from '#lib/wellness/Ring.svelte';
	import { getWellnessStore } from '#lib/wellness/store';
	import { progressPercent, shanghaiToday } from '#lib/wellness/water';

	const store = getWellnessStore();
	let date = $state(shanghaiToday());
	let snapshot = $state(store.today(date));

	function refresh() {
		snapshot = store.today(date);
	}

	function addCup() {
		store.addWater(250, date);
		refresh();
	}
</script>

<svelte:head>
	<title>轻心 · 健康</title>
</svelte:head>

<Card>
	<p class="text-base text-[var(--qx-muted)]">{date} 喝水进度</p>
	<Ring
		percent={progressPercent(snapshot.water.totalMl, snapshot.water.targetMl)}
		label="今日目标"
	/>
	<p class="mt-2 text-center text-base">
		{snapshot.water.totalMl} / {snapshot.water.targetMl} ml
	</p>
	<Button class="mt-4 w-full" onclick={addCup}>+1 杯（250 ml）</Button>
</Card>

<Card>
	<h2 class="text-lg font-semibold">睡眠</h2>
	{#if snapshot.sleep}
		<p class="mt-2 text-base">
			质量 {snapshot.sleep.quality}/5
			{#if snapshot.sleep.note}
				· {snapshot.sleep.note}
			{/if}
		</p>
	{:else}
		<p class="mt-2 text-base text-[var(--qx-muted)]">还没有睡眠打卡。</p>
	{/if}
	<Button href="/wellness/record" variant="secondary" class="mt-4 w-full">去记录</Button>
</Card>

<Disclaimer />

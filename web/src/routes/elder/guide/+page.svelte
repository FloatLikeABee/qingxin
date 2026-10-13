<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import { SYSTEM_TUTORIALS, type ElderTutorial } from '#lib/elder/demo';

	let selected = $state<ElderTutorial | null>(null);
	let step = $state(0);

	function open(item: ElderTutorial) {
		selected = item;
		step = 0;
	}

	function speak(text: string) {
		if (typeof speechSynthesis === 'undefined') return;
		speechSynthesis.cancel();
		const utter = new SpeechSynthesisUtterance(text);
		utter.lang = 'zh-CN';
		speechSynthesis.speak(utter);
	}
</script>

<svelte:head>
	<title>轻心 · 办事指引</title>
</svelte:head>

<section class="mx-auto max-w-2xl space-y-5">
	<a href="/elder" class="inline-flex min-h-14 items-center text-lg">← 返回首页</a>
	<h1 class="text-3xl font-semibold">办事指引</h1>
	{#if !selected}
		<div class="space-y-3">
			{#each SYSTEM_TUTORIALS as item (item.id)}
				<button
					type="button"
					class="flex min-h-14 w-full items-center rounded-3xl bg-[var(--qx-card)] px-5 text-left text-xl font-semibold ring-1 ring-[var(--qx-line)]"
					onclick={() => open(item)}
				>
					{item.title}
				</button>
			{/each}
		</div>
	{:else}
		<Card class="space-y-4">
			<p class="text-sm text-[var(--qx-muted)]">第 {step + 1} / {selected.steps.length} 步</p>
			<h2 class="text-2xl font-semibold">{selected.title}</h2>
			<p class="text-xl leading-8">{selected.steps[step]?.text}</p>
			<div class="flex flex-col gap-3">
				<Button class="min-h-14 text-lg" onclick={() => speak(selected?.steps[step]?.text ?? '')}>
					朗读
				</Button>
				{#if step < selected.steps.length - 1}
					<Button class="min-h-14 text-lg" onclick={() => (step += 1)}>下一步</Button>
				{/if}
				<Button variant="secondary" class="min-h-14 text-lg" onclick={() => (selected = null)}>
					返回列表
				</Button>
			</div>
		</Card>
	{/if}
</section>

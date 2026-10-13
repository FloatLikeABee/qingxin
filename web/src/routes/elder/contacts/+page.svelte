<script lang="ts">
	import { browser } from '$app/env';
	import Card from '#lib/components/Card.svelte';
	import type { ElderContact } from '#lib/elder/demo';
	import { getElderStore } from '#lib/elder/store';

	const store = getElderStore();
	let contacts = $state<ElderContact[]>(store.contacts);

	$effect(() => {
		if (!browser) return;
		void store.hydrate().then(() => {
			contacts = store.contacts;
		});
	});
</script>

<svelte:head>
	<title>轻心 · 电话簿</title>
</svelte:head>

<section class="mx-auto max-w-2xl space-y-5">
	<a href="/elder" class="inline-flex min-h-14 items-center text-lg">← 返回首页</a>
	<h1 class="text-3xl font-semibold">电话簿</h1>
	<p class="text-lg text-[var(--qx-muted)]">大按钮拨号。离线也能打开已保存的号码。</p>
	<div class="space-y-3">
		{#each contacts as contact (contact.id)}
			<Card>
				<p class="text-xl font-semibold">{contact.name}</p>
				<p class="text-lg text-[var(--qx-muted)]">{contact.relation}</p>
				<a
					class="mt-4 flex min-h-14 items-center justify-center rounded-2xl bg-[var(--qx-primary)] text-xl font-semibold text-white"
					href="tel:{contact.phone}"
				>
					呼叫 {contact.phone}
				</a>
			</Card>
		{/each}
	</div>
</section>

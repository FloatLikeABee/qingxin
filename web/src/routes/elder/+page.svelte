<script lang="ts">
	import { browser } from '$app/env';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import { getElderStore } from '#lib/elder/store';
	import { shanghaiClock } from '#lib/elder/due';
	import type { ElderContact, ElderReminder } from '#lib/elder/demo';

	const store = getElderStore();
	let reminders = $state<ElderReminder[]>([]);
	let contacts = $state<ElderContact[]>([]);
	let disclaimer = $state(store.disclaimer);
	let medical = $state(store.medicalDisclaimer);
	let dueOpen = $state(false);
	let due = $state<ElderReminder | undefined>();
	let acked = $state<string[]>([]);

	function refreshDue(now = new Date()) {
		due = store.dueReminder(now);
		acked = store.ackedToday(now);
		dueOpen = Boolean(due);
	}

	$effect(() => {
		if (!browser) return;
		void store.hydrate().then(() => {
			reminders = store.reminders;
			contacts = store.contacts;
			disclaimer = store.disclaimer;
			medical = store.medicalDisclaimer;
			refreshDue();
		});
		const id = window.setInterval(() => refreshDue(), 60_000);
		return () => window.clearInterval(id);
	});

	function speak(text: string) {
		if (typeof speechSynthesis === 'undefined') return;
		speechSynthesis.cancel();
		const utter = new SpeechSynthesisUtterance(text);
		utter.lang = 'zh-CN';
		speechSynthesis.speak(utter);
	}

	async function ack() {
		if (!due) return;
		await store.ack(due.id);
		dueOpen = false;
		refreshDue();
	}

	const tools = [
		{ href: '/elder/contacts', label: '电话簿', icon: 'user' },
		{ href: '/elder/guide', label: '办事指引', icon: 'book' },
		{ href: '/elder/anti-fraud', label: '防诈卫士', icon: 'lock' },
		{ href: '/elder/family', label: '家人设置', icon: 'heart' }
	];
</script>

<svelte:head>
	<title>轻心 · 老人助手</title>
</svelte:head>

<section class="elder-home mx-auto max-w-2xl space-y-5">
	<div>
		<p class="text-sm text-[var(--qx-muted)]">老人助手</p>
		<h1 class="text-3xl font-semibold">今天先做这几件</h1>
		<p class="sr-only">{shanghaiClock(new Date()).date}</p>
	</div>

	<Card class="space-y-3">
		<h2 class="text-xl font-semibold">今日提醒</h2>
		{#if reminders.length === 0}
			<p class="text-lg text-[var(--qx-muted)]">今天没有用药提醒。</p>
		{:else}
			<ul class="space-y-3">
				{#each reminders as item (item.id)}
					<li class="rounded-2xl bg-[var(--qx-surface)] p-4">
						<p class="text-xl font-semibold">{item.time} · {item.title}</p>
						<p class="text-lg">{item.body}</p>
						<p class="text-sm text-[var(--qx-muted)]">
							{acked.includes(item.id) ? '已确认' : '待确认'}
						</p>
					</li>
				{/each}
			</ul>
		{/if}
		<p class="text-base text-[var(--qx-muted)]">{disclaimer}</p>
	</Card>

	<Card class="space-y-3">
		<h2 class="text-xl font-semibold">紧急呼叫</h2>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			{#each contacts.filter((c) => c.isEmergency) as contact (contact.id)}
				<a
					class="flex min-h-14 items-center justify-center rounded-2xl bg-rose-600 text-xl font-semibold text-white"
					href="tel:{contact.phone}"
				>
					{contact.name}
					{contact.phone}
				</a>
			{/each}
		</div>
	</Card>

	<div class="grid grid-cols-2 gap-3">
		{#each tools as tool (tool.href)}
			<a
				href={tool.href}
				class="flex min-h-14 flex-col items-center justify-center gap-2 rounded-3xl bg-[var(--qx-card)] p-5 text-lg font-medium ring-1 ring-[var(--qx-line)]"
			>
				<Icon name={tool.icon} class="h-7 w-7" />
				{tool.label}
			</a>
		{/each}
	</div>

	<p class="text-sm text-[var(--qx-muted)]">{medical}</p>
</section>

<Modal bind:open={dueOpen} title="该吃药了" dismissible={false}>
	<p class="text-xl text-[var(--qx-text)]">{due?.title} · {due?.body}</p>
	<p class="text-base">{disclaimer}</p>
	<p class="text-sm">{medical}</p>
	{#snippet footer()}
		<Button
			class="min-h-14 w-full text-lg"
			onclick={() => speak(due?.voiceText || due?.title || '')}
		>
			朗读
		</Button>
		<Button class="min-h-14 w-full text-lg" onclick={ack}>我已吃药</Button>
	{/snippet}
</Modal>

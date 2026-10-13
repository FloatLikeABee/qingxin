<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import { allContacts, loadDemo, saveDemo, todayCopy } from '#lib/elder/demo';
	import { MEDICAL_DISCLAIMER, REMINDER_DISCLAIMER } from '#lib/elder/schedule';

	let demo = $state(loadDemo());
	const copy = todayCopy();
	let dueOpen = $state(false);
	const due = $derived(demo.reminders.find((item) => !demo.acked.includes(item.id)));

	$effect(() => {
		if (due) dueOpen = true;
	});

	function speak(text: string) {
		if (typeof speechSynthesis === 'undefined') return;
		speechSynthesis.cancel();
		const utter = new SpeechSynthesisUtterance(text);
		utter.lang = 'zh-CN';
		speechSynthesis.speak(utter);
	}

	function ack() {
		if (!due) return;
		demo = { ...demo, acked: [...demo.acked, due.id] };
		saveDemo(demo);
		dueOpen = false;
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
	</div>

	<Card class="space-y-3">
		<h2 class="text-xl font-semibold">今日提醒</h2>
		{#if demo.reminders.length === 0}
			<p class="text-lg text-[var(--qx-muted)]">今天没有用药提醒。</p>
		{:else}
			<ul class="space-y-3">
				{#each demo.reminders as item (item.id)}
					<li class="rounded-2xl bg-[var(--qx-surface)] p-4">
						<p class="text-xl font-semibold">{item.time} · {item.title}</p>
						<p class="text-lg">{item.body}</p>
						<p class="text-sm text-[var(--qx-muted)]">
							{demo.acked.includes(item.id) ? '已确认' : '待确认'}
						</p>
					</li>
				{/each}
			</ul>
		{/if}
		<p class="text-base text-[var(--qx-muted)]">{copy.disclaimer}</p>
	</Card>

	<Card class="space-y-3">
		<h2 class="text-xl font-semibold">紧急呼叫</h2>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			{#each allContacts(demo).filter((c) => c.isEmergency) as contact (contact.id)}
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

	<p class="text-sm text-[var(--qx-muted)]">{copy.medical}</p>
</section>

<Modal bind:open={dueOpen} title="该吃药了" dismissible={false}>
	<p class="text-xl text-[var(--qx-text)]">{due?.title} · {due?.body}</p>
	<p class="text-base">{REMINDER_DISCLAIMER}</p>
	<p class="text-sm">{MEDICAL_DISCLAIMER}</p>
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

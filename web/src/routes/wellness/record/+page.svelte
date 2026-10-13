<script lang="ts">
	import { browser } from '$app/env';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import Input from '#lib/components/Input.svelte';
	import Switch from '#lib/components/Switch.svelte';
	import Textarea from '#lib/components/Textarea.svelte';
	import Disclaimer from '#lib/wellness/Disclaimer.svelte';
	import { PREDICTION_LABEL } from '#lib/wellness/disclaimer';
	import { predictCycle } from '#lib/wellness/cycle';
	import { getWellnessStore } from '#lib/wellness/store';
	import { shanghaiToday } from '#lib/wellness/water';

	const store = getWellnessStore();
	let quality = $state('4');
	let note = $state('');
	let startDate = $state(shanghaiToday());
	let symptoms = $state('');
	let consent = $state(false);
	let hydrated = $state(false);
	let message = $state('');
	let starts = $state<string[]>([]);

	$effect(() => {
		if (!browser) return;
		void store.hydrate().then(() => {
			consent = store.cycleConsent;
			starts = store.cycles.map((row) => row.startDate);
			hydrated = true;
		});
	});

	$effect(() => {
		if (!hydrated) return;
		if (consent === store.cycleConsent) return;
		void store.setCycleConsent(consent).then(() => {
			starts = store.cycles.map((row) => row.startDate);
			if (!consent) message = '已关闭经期记录并删除本地周期。';
		});
	});

	async function saveSleep() {
		const wake = new Date();
		const sleep = new Date(wake.getTime() - 8 * 3600_000);
		await store.addSleep({
			sleepAt: sleep.toISOString(),
			wakeAt: wake.toISOString(),
			quality: Number(quality),
			note: note.trim() || undefined
		});
		message = '已记下睡眠。';
	}

	async function saveCycle() {
		try {
			await store.addCycle({ startDate, symptoms: symptoms.trim() || undefined });
			starts = store.cycles.map((row) => row.startDate);
			message = '已记下周期。';
		} catch {
			message = '需要先开启经期记录同意。';
		}
	}

	const prediction = $derived(
		consent && starts.length ? predictCycle([...starts].reverse()) : null
	);
</script>

<svelte:head>
	<title>轻心 · 健康记录</title>
</svelte:head>

<Card>
	<h1 class="text-2xl font-semibold">记录</h1>
	<Disclaimer />
</Card>

<Card>
	<h2 class="text-lg font-semibold">睡眠打卡</h2>
	<Input label="睡眠质量 1–5" type="number" min="1" max="5" bind:value={quality} class="mt-3" />
	<Textarea label="备注（加密保存）" bind:value={note} class="mt-3" />
	<Button class="mt-4 w-full" onclick={saveSleep}>保存睡眠</Button>
</Card>

<Card>
	<h2 class="text-lg font-semibold">经期记录</h2>
	<p class="mt-2 text-sm text-[var(--qx-muted)]">关闭后将删除经期记录。此为敏感个人信息。</p>
	<div class="mt-3">
		<Switch
			bind:checked={consent}
			label="同意记录经期数据"
			description="默认关闭。仅保存在你的账号里，照料人不可见。"
		/>
	</div>
	{#if consent}
		<Input label="开始日期" type="date" bind:value={startDate} class="mt-4" />
		<Textarea label="症状（加密保存）" bind:value={symptoms} class="mt-3" />
		<Button class="mt-4 w-full" onclick={saveCycle}>保存周期</Button>
		{#if prediction}
			<p class="mt-3 text-base">
				下次预计 {prediction.nextStart}
				<span class="text-[var(--qx-muted)]">（{PREDICTION_LABEL}）</span>
			</p>
		{/if}
	{/if}
</Card>

{#if message}
	<p class="text-base">{message}</p>
{/if}

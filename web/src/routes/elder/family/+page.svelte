<script lang="ts">
	import { browser } from '$app/env';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import Input from '#lib/components/Input.svelte';
	import Switch from '#lib/components/Switch.svelte';
	import type { ElderReminder } from '#lib/elder/demo';
	import { REMINDER_DISCLAIMER, validateReminderSchedule } from '#lib/elder/schedule';
	import { getElderStore } from '#lib/elder/store';

	const weekdayLabels = [
		{ id: 1, label: '一' },
		{ id: 2, label: '二' },
		{ id: 3, label: '三' },
		{ id: 4, label: '四' },
		{ id: 5, label: '五' },
		{ id: 6, label: '六' },
		{ id: 7, label: '日' }
	];

	const store = getElderStore();
	let reminders = $state<ElderReminder[]>([]);
	let optIn = $state(false);
	let hydrated = $state(false);
	let title = $state('降压药');
	let body = $state('早餐后一粒');
	let time = $state('08:00');
	let days = $state([1, 2, 3, 4, 5]);
	let error = $state('');

	$effect(() => {
		if (!browser) return;
		void store.hydrate().then(() => {
			reminders = store.reminders;
			optIn = store.optInLog;
			hydrated = true;
		});
	});

	$effect(() => {
		if (!hydrated) return;
		const next = optIn;
		if (next === store.optInLog) return;
		void store.setOptIn(next);
	});

	function toggleDay(id: number) {
		days = days.includes(id) ? days.filter((day) => day !== id) : [...days, id];
	}

	async function addReminder() {
		const parsed = validateReminderSchedule({ time, daysOfWeek: days });
		if (!parsed.ok) {
			error = '请填写时间，并至少选择一个星期几。不要使用 cron。';
			return;
		}
		try {
			await store.createReminder({
				title: title.trim() || '提醒',
				body: body.trim() || '请按时完成',
				kind: 'medication',
				time: parsed.time,
				daysOfWeek: parsed.daysOfWeek,
				voiceText: `${title}，${body}`
			});
			reminders = store.reminders;
			error = '';
		} catch (err) {
			error = err instanceof Error ? err.message : '保存失败';
		}
	}
</script>

<svelte:head>
	<title>轻心 · 家人设置</title>
</svelte:head>

<section class="mx-auto max-w-2xl space-y-5">
	<a href="/elder" class="inline-flex min-h-14 items-center text-lg">← 返回首页</a>
	<h1 class="text-3xl font-semibold">家人远程设置</h1>
	<Card class="space-y-3">
		<h2 class="text-xl font-semibold">绑定与平板登录</h2>
		<p class="text-lg text-[var(--qx-muted)]">
			老人助手复用 T1
			的亲情绑定：老人在已登录账号上创建邀请码，子女接受后即可远程管理，并可为客厅平板签发长期设备会话（<code
				>Authorization: Device</code
			>）。这里不再做第二套登录。
		</p>
		<a class="inline-flex min-h-14 items-center text-lg text-[var(--qx-primary)]" href="/settings">
			去设置页查看账号 →
		</a>
	</Card>

	<Card class="space-y-4">
		<h2 class="text-xl font-semibold">添加用药提醒</h2>
		<p class="text-base text-[var(--qx-muted)]">{REMINDER_DISCLAIMER}</p>
		<Input bind:value={title} label="名称" />
		<Input bind:value={body} label="说明" />
		<Input bind:value={time} label="时间（每天）" type="time" />
		<div>
			<p class="mb-2 text-base font-medium">星期</p>
			<div class="flex flex-wrap gap-2">
				{#each weekdayLabels as day (day.id)}
					<button
						type="button"
						class="min-h-14 min-w-14 rounded-2xl text-lg ring-1 ring-[var(--qx-line)] {days.includes(
							day.id
						)
							? 'bg-[var(--qx-primary)] text-white'
							: 'bg-[var(--qx-surface)]'}"
						onclick={() => toggleDay(day.id)}
					>
						{day.label}
					</button>
				{/each}
			</div>
		</div>
		{#if error}
			<p class="text-rose-600">{error}</p>
		{/if}
		<Button class="min-h-14 w-full text-lg" onclick={addReminder}>保存提醒</Button>
		<ul class="space-y-2 text-lg">
			{#each reminders as item (item.id)}
				<li>{item.time} {item.title}（周 {item.daysOfWeek.join(' / ')}）</li>
			{/each}
		</ul>
	</Card>

	<Card>
		<Switch
			bind:checked={optIn}
			label="允许子女查看使用记录"
			description="默认关闭。记录不含通话内容和电话号码。"
		/>
	</Card>
	<p class="text-sm text-[var(--qx-muted)]">
		错过用药时，子女会收到站内通知，并走 T1 的短信桩记录。
	</p>
</section>

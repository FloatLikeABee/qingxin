<script lang="ts">
	import { page } from '$app/state';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Input from '#lib/components/Input.svelte';
	import Textarea from '#lib/components/Textarea.svelte';
	import DisclaimerBanner from '#lib/pets/DisclaimerBanner.svelte';
	import WeightChart from '#lib/pets/WeightChart.svelte';
	import { getPetsStore } from '#lib/pets/store';
	import { RECORD_LABEL, type RecordType } from '#lib/pets/types';
	import { formatKg, parseGrams } from '#lib/pets/weight';

	const store = getPetsStore();
	const pet = $derived(store.pet(page.params.id ?? ''));
	let recordType = $state<RecordType>('vaccine');
	let recordDate = $state(new Date().toISOString().slice(0, 10));
	let nextDue = $state('');
	let note = $state('');
	let measuredOn = $state(new Date().toISOString().slice(0, 10));
	let grams = $state('');
	let tick = $state(0);

	function records() {
		void tick;
		return pet ? store.recordsFor(pet.id) : [];
	}
	function weights() {
		void tick;
		return pet ? store.weightsFor(pet.id) : [];
	}

	function addRecord() {
		if (!pet) return;
		store.addRecord(pet.id, {
			type: recordType,
			date: recordDate,
			nextDueDate: nextDue || null,
			note
		});
		note = '';
		nextDue = '';
		tick += 1;
	}

	function addWeight() {
		if (!pet) return;
		const weightG = parseGrams(grams);
		if (weightG === null) return;
		store.addWeight(pet.id, { measuredOn, weightG });
		grams = '';
		tick += 1;
	}
</script>

<svelte:head>
	<title>轻心 · {pet?.name ?? '宠物档案'}</title>
</svelte:head>

<a href="/pets" class="inline-flex min-h-11 items-center text-base text-[var(--qx-muted)]">← 今日</a
>
<DisclaimerBanner />

{#if !pet}
	<Card>
		<EmptyState title="找不到这份档案" body="可能是另一台设备上的记录，或已经删除。" />
	</Card>
{:else}
	<h1 class="text-3xl font-semibold">{pet.name}</h1>
	<Card>
		<h2 class="text-lg font-semibold">体重曲线</h2>
		<div class="mt-3">
			<WeightChart points={weights()} />
		</div>
		<div class="mt-4 grid gap-3 sm:grid-cols-2">
			<Input label="日期" type="date" bind:value={measuredOn} />
			<Input label="克" inputmode="numeric" bind:value={grams} placeholder="4200" />
		</div>
		<div class="mt-3">
			<Button onclick={addWeight}>记下体重</Button>
		</div>
	</Card>

	<Card>
		<h2 class="text-lg font-semibold">健康记录</h2>
		<label class="mt-3 block space-y-2">
			<span class="text-base font-medium">类型</span>
			<select
				class="min-h-11 w-full rounded-2xl border border-[var(--qx-line)] bg-[var(--qx-bg)] px-4 text-base"
				bind:value={recordType}
			>
				{#each Object.entries(RECORD_LABEL) as [value, label] (value)}
					<option {value}>{label}</option>
				{/each}
			</select>
		</label>
		<Input class="mt-3" label="日期" type="date" bind:value={recordDate} />
		<Input class="mt-3" label="下次到期（可选）" type="date" bind:value={nextDue} />
		<Textarea class="mt-3" label="备注" bind:value={note} />
		<div class="mt-3">
			<Button onclick={addRecord}>保存记录</Button>
		</div>
		<ul class="mt-4 space-y-3">
			{#each records() as item (item.id)}
				<li class="rounded-2xl bg-[var(--qx-surface)] px-4 py-3">
					<p class="font-medium">{RECORD_LABEL[item.type]} · {item.date}</p>
					{#if item.nextDueDate}
						<p class="text-sm text-[var(--qx-muted)]">下次 {item.nextDueDate}</p>
					{/if}
					{#if item.note}
						<p class="text-base">{item.note}</p>
					{/if}
					{#if item.type === 'vet_visit' && weights().length}
						<p class="text-sm text-[var(--qx-muted)]">
							最近体重 {formatKg(weights().at(-1)?.weightG ?? 0)}
						</p>
					{/if}
				</li>
			{/each}
		</ul>
	</Card>
{/if}

<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Input from '#lib/components/Input.svelte';
	import DisclaimerBanner from '#lib/pets/DisclaimerBanner.svelte';
	import { getPetsStore } from '#lib/pets/store';
	import {
		CARE_LABEL,
		CARE_TYPES,
		SPECIES_LABEL,
		type CareType,
		type PetSpecies
	} from '#lib/pets/types';
	import { pushToast } from '#lib/toast';

	const store = getPetsStore();
	let selected = $state(0);
	let name = $state('');
	let species = $state<PetSpecies>('cat');
	let avatarUrl = $state('');
	let busy = $state(false);
	let ready = $state(false);

	onMount(() => {
		void store
			.load()
			.catch((error) => {
				pushToast({ title: '无法加载宠物', body: String(error), tone: 'danger' });
			})
			.finally(() => {
				ready = true;
			});
	});

	async function addPet() {
		if (!name.trim() || busy) return;
		busy = true;
		try {
			await store.createPet({
				name: name.trim(),
				species,
				avatarUrl: avatarUrl.trim() || null
			});
			name = '';
			avatarUrl = '';
			selected = store.pets.length - 1;
		} catch (error) {
			pushToast({ title: '没有保存', body: String(error), tone: 'danger' });
		} finally {
			busy = false;
		}
	}

	async function checkIn(petId: string, type: CareType) {
		try {
			await store.addLog(petId, { type });
		} catch (error) {
			pushToast({ title: '打卡失败', body: String(error), tone: 'danger' });
		}
	}

	const current = $derived(store.pets[selected]);
	const todayItem = $derived(store.summary.items.find((item) => item.petId === current?.id));
</script>

<svelte:head>
	<title>轻心 · 宠物</title>
</svelte:head>

<h1 class="text-3xl font-semibold">宠物</h1>
<DisclaimerBanner />

{#if store.pets.length === 0}
	<Card>
		<EmptyState title="还没有毛孩子" body="先建一份档案，再打卡喂食和遛弯。" icon="spark">
			{#snippet action()}
				<div class="space-y-3 text-left">
					<Input label="名字" bind:value={name} placeholder="豆豆" />
					<label class="block space-y-2">
						<span class="text-base font-medium">物种</span>
						<select
							class="min-h-11 w-full rounded-2xl border border-[var(--qx-line)] bg-[var(--qx-bg)] px-4 text-base"
							bind:value={species}
						>
							{#each Object.entries(SPECIES_LABEL) as [value, label] (value)}
								<option {value}>{label}</option>
							{/each}
						</select>
					</label>
					<Input label="头像链接（可选）" bind:value={avatarUrl} placeholder="https://" />
					<Button onclick={addPet} disabled={busy || !ready}>添加宠物</Button>
				</div>
			{/snippet}
		</EmptyState>
	</Card>
{:else}
	<div class="flex flex-wrap gap-2">
		{#each store.pets as pet, index (pet.id)}
			<button
				type="button"
				class="inline-flex min-h-11 items-center rounded-2xl px-4 text-base {selected === index
					? 'bg-[var(--qx-primary)] text-white'
					: 'bg-[var(--qx-surface)] text-[var(--qx-text)]'}"
				onclick={() => (selected = index)}
			>
				{pet.name}
			</button>
		{/each}
	</div>

	{#if current}
		<Card>
			<div class="flex items-center gap-4">
				{#if current.avatarUrl}
					<img
						src={current.avatarUrl}
						alt=""
						class="h-16 w-16 rounded-full object-cover ring-1 ring-[var(--qx-line)]"
					/>
				{:else}
					<div
						class="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--qx-surface)] text-lg"
					>
						{current.name.slice(0, 1)}
					</div>
				{/if}
				<div>
					<h2 class="text-xl font-semibold">{current.name}</h2>
					<p class="text-base text-[var(--qx-muted)]">{SPECIES_LABEL[current.species]}</p>
				</div>
			</div>
			<div class="mt-4">
				<Button href="/pets/{current.id}" variant="secondary">打开档案</Button>
			</div>
		</Card>

		<Card>
			<h2 class="text-lg font-semibold">今日待办</h2>
			<ul class="mt-3 space-y-2">
				{#each CARE_TYPES as type (type)}
					<li class="flex min-h-11 items-center justify-between text-base">
						<span>{CARE_LABEL[type]} · 已完成 {todayItem?.done[type] ?? 0}</span>
						<Button variant="secondary" onclick={() => checkIn(current.id, type)}>打卡</Button>
					</li>
				{/each}
			</ul>
		</Card>
	{/if}
{/if}

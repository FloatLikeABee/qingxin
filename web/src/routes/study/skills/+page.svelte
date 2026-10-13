<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Input from '#lib/components/Input.svelte';
	import Disclaimer from '#lib/study/Disclaimer.svelte';
	import SkillTree from '#lib/study/SkillTree.svelte';
	import { getStudyStore } from '#lib/study/store';
	import { pushToast } from '#lib/toast';

	const store = getStudyStore();
	let title = $state('');

	onMount(() => {
		void store.load();
	});

	async function add() {
		if (!title.trim()) return;
		try {
			await store.addSkill({ title: title.trim() });
			title = '';
		} catch (error) {
			pushToast({ title: '没有保存', body: String(error), tone: 'danger' });
		}
	}

	async function template(id: string) {
		try {
			await store.applyTemplate(id);
		} catch (error) {
			pushToast({ title: '无法套用模板', body: String(error), tone: 'danger' });
		}
	}
</script>

<svelte:head>
	<title>轻心 · 技能树</title>
</svelte:head>

<Card>
	<h1 class="text-2xl font-semibold">技能树</h1>
	<p class="mt-2 text-base text-[var(--qx-muted)]">自己点亮节点，也可以从模板复制一份。</p>
	<Input label="新节点" bind:value={title} />
	<Button class="mt-4 w-full" onclick={add}>添加节点</Button>
	<div class="mt-3 grid gap-2 sm:grid-cols-2">
		{#each store.templates as item (item.id)}
			<Button variant="secondary" onclick={() => template(item.id)}>{item.title}模板</Button>
		{/each}
	</div>
</Card>

{#if store.skills.length === 0}
	<Card>
		<EmptyState title="树还是空的" body="加一个根节点，或套用内置模板。" icon="spark" />
	</Card>
{:else}
	<SkillTree
		nodes={store.skills}
		ontoggle={(id) => {
			void store.toggleSkill(id);
		}}
	/>
{/if}

<Disclaimer />

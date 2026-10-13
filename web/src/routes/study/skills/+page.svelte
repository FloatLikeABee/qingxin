<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Input from '#lib/components/Input.svelte';
	import Disclaimer from '#lib/study/Disclaimer.svelte';
	import SkillTree from '#lib/study/SkillTree.svelte';
	import { getStudyStore } from '#lib/study/store';

	const store = getStudyStore();
	let title = $state('');
	let tick = $state(0);

	function add() {
		if (!title.trim()) return;
		store.addSkill({ title: title.trim() });
		title = '';
		tick += 1;
	}

	function template(id: 'english-vocab' | 'piano') {
		store.applyTemplate(id);
		tick += 1;
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
		<Button variant="secondary" onclick={() => template('english-vocab')}>英语词汇模板</Button>
		<Button variant="secondary" onclick={() => template('piano')}>钢琴模板</Button>
	</div>
</Card>

{#key tick}
	{#if store.skills.length === 0}
		<Card>
			<EmptyState title="树还是空的" body="加一个根节点，或套用内置模板。" icon="spark" />
		</Card>
	{:else}
		<SkillTree
			nodes={store.skills}
			ontoggle={(id) => {
				store.toggleSkill(id);
				tick += 1;
			}}
		/>
	{/if}
{/key}

<Disclaimer />

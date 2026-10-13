<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Input from '#lib/components/Input.svelte';
	import Textarea from '#lib/components/Textarea.svelte';
	import Disclaimer from '#lib/study/Disclaimer.svelte';
	import { getStudyStore } from '#lib/study/store';
	import { pushToast } from '#lib/toast';

	const store = getStudyStore();
	let title = $state('');
	let tags = $state('');
	let content = $state('');
	let query = $state('');

	onMount(() => {
		void store.load();
	});

	async function add() {
		if (!title.trim()) return;
		try {
			await store.addNote({
				title: title.trim(),
				contentMd: content,
				tags: tags
					.split(/[,，]/)
					.map((item) => item.trim())
					.filter(Boolean)
			});
			title = '';
			tags = '';
			content = '';
		} catch (error) {
			pushToast({ title: '没有保存', body: String(error), tone: 'danger' });
		}
	}

	const shown = $derived(store.searchNotes(query));
</script>

<svelte:head>
	<title>轻心 · 学习笔记</title>
</svelte:head>

<Card>
	<h1 class="text-2xl font-semibold">阅读笔记</h1>
	<p class="mt-2 text-base text-[var(--qx-muted)]">Markdown 正文加密保存。搜索只看标题和标签。</p>
	<Input label="标题" bind:value={title} />
	<Input label="标签" hint="用逗号分隔" bind:value={tags} />
	<Textarea label="正文" bind:value={content} class="mt-3" rows={5} />
	<Button class="mt-4 w-full" onclick={add}>保存笔记</Button>
</Card>

<Card>
	<Input label="搜索标题或标签" bind:value={query} />
</Card>

{#if shown.length === 0}
	<Card>
		<EmptyState
			title="没有匹配的笔记"
			body="换个标题或标签再试。正文不会出现在搜索结果里。"
			icon="spark"
		/>
	</Card>
{:else}
	{#each shown as item (item.id)}
		<Card>
			<h2 class="text-lg font-semibold">{item.title}</h2>
			<p class="mt-1 text-sm text-[var(--qx-muted)]">{item.tags.join(' · ') || '无标签'}</p>
			<pre class="mt-3 overflow-x-auto text-base whitespace-pre-wrap">{item.contentMd}</pre>
		</Card>
	{/each}
{/if}

<Disclaimer />

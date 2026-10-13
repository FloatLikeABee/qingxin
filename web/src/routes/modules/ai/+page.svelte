<script lang="ts">
	import { onMount } from 'svelte';
	import { getApi } from '#lib/api/client';
	import type { AiTask, ToolCatalog, ToolRunInput } from '#lib/api/types';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Input from '#lib/components/Input.svelte';
	import Skeleton from '#lib/components/Skeleton.svelte';
	import Tabs from '#lib/components/Tabs.svelte';
	import Tag from '#lib/components/Tag.svelte';
	import Textarea from '#lib/components/Textarea.svelte';
	import { DISCLAIMER } from '#lib/tools/ai';
	import {
		POLISH_TONES,
		TOOLS,
		type InputKind,
		type PolishTone,
		type ToolId
	} from '#lib/tools/catalog';
	import { downloadText, taskToMarkdown } from '#lib/tools/export';
	import { filterTasks, groupTasksByTime, SHIMMER_CLASS } from '#lib/tools/history';
	import {
		cacheCatalog,
		cacheTasks,
		loadCachedCatalog,
		loadCachedTasks,
		toggleFavourite
	} from '#lib/tools/store';
	import { pushToast } from '#lib/toast';

	let tab = $state(0);
	let needLogin = $state(false);
	let pending = $state(false);
	let thinking = $state(false);
	let catalog = $state<ToolCatalog>({ items: [], recent: [], favourites: [] });
	let tasks = $state<AiTask[]>([]);
	let toolId = $state<ToolId>('summary');
	let inputKind = $state<InputKind>('text');
	let text = $state('明天交周报，并回复客户邮件。');
	let url = $state('https://example.com/notes');
	let filename = $state('');
	let resume = $state('熟悉 Rust 与前端，做过记账应用。');
	let jd = $state('招聘全栈，要求 Rust 与 TypeScript。');
	let filenames = $state('会议 最终 final (1).docx\nIMG_0001.jpg');
	let tone = $state<PolishTone>('更专业');
	let output = $state('');
	let lastTask = $state<AiTask | null>(null);
	let historyTool = $state<ToolId | 'all'>('all');
	let lastInput = $state<ToolRunInput | null>(null);
	let runError = $state('');
	let stopped = $state(false);
	let abortCtrl: AbortController | null = null;
	let runGeneration = 0;

	const summaryKinds: { id: InputKind; label: string }[] = [
		{ id: 'text', label: '文本' },
		{ id: 'url', label: '链接' },
		{ id: 'pdf', label: 'PDF' }
	];
	const current = $derived(catalog.items.find((item) => item.id === toolId) ?? catalog.items[0]);
	const history = $derived(filterTasks(tasks, historyTool));
	const historyGroups = $derived(groupTasksByTime(history));
	const recentTools = $derived(
		catalog.recent
			.map((id) => catalog.items.find((item) => item.id === id))
			.filter((item): item is NonNullable<typeof item> => Boolean(item))
	);
	const favTools = $derived(catalog.items.filter((item) => item.favourite));

	async function refresh() {
		const api = getApi();
		catalog = await api.listTools();
		tasks = await api.listAiTasks(historyTool === 'all' ? undefined : historyTool);
		await cacheCatalog(catalog);
		await cacheTasks(tasks);
	}

	async function selectHistoryTool(id: ToolId | 'all') {
		historyTool = id;
		try {
			tasks = await getApi().listAiTasks(id === 'all' ? undefined : id);
			await cacheTasks(tasks);
		} catch (error) {
			pushToast({
				title: '没能完成',
				body: error instanceof Error ? error.message : '请稍后再试',
				tone: 'danger'
			});
		}
	}

	function openTool(id: ToolId) {
		toolId = id;
		tab = 1;
	}

	function buildInput(step?: 'topics' | 'decisions'): ToolRunInput {
		const input: ToolRunInput = { toolId };
		if (toolId === 'summary') {
			input.inputKind = inputKind;
			input.text = text;
			if (inputKind === 'url') input.url = url;
			if (inputKind === 'pdf') input.filename = filename || 'notes.pdf';
		} else if (toolId === 'resume_jd') {
			input.resume = resume;
			input.jd = jd;
		} else if (toolId === 'rename') {
			input.filenames = filenames
				.split('\n')
				.map((item) => item.trim())
				.filter(Boolean);
		} else if (toolId === 'polish') {
			input.text = text;
			input.tone = tone;
		} else if (toolId === 'meeting') {
			input.text = text;
			input.step = step ?? 'topics';
		} else {
			input.text = text;
		}
		return input;
	}

	function stopRun() {
		abortCtrl?.abort();
	}

	async function run(step?: 'topics' | 'decisions') {
		abortCtrl?.abort();
		const generation = ++runGeneration;
		abortCtrl = new AbortController();
		const signal = abortCtrl.signal;
		pending = true;
		thinking = true;
		stopped = false;
		runError = '';
		output = '';
		lastTask = null;
		const input = buildInput(step);
		lastInput = input;
		try {
			for await (const event of getApi().runTool({ ...input, signal })) {
				if (generation !== runGeneration) return;
				if (event.type === 'delta') {
					thinking = false;
					output += event.text;
				} else {
					lastTask = event.task;
					output = event.task.outputText;
					thinking = false;
				}
			}
			if (generation !== runGeneration) return;
			if (signal.aborted) {
				stopped = true;
				thinking = false;
				return;
			}
			await refresh();
		} catch (error) {
			if (generation !== runGeneration) return;
			thinking = false;
			if (signal.aborted) {
				stopped = true;
			} else {
				runError = error instanceof Error ? error.message : '请稍后再试';
				pushToast({
					title: '没能完成',
					body: runError,
					tone: 'danger'
				});
			}
		} finally {
			if (generation === runGeneration) pending = false;
		}
	}

	async function copyOut() {
		const value = lastTask?.outputText ?? output;
		try {
			await navigator.clipboard.writeText(value);
			pushToast({ title: '已复制', tone: 'success' });
		} catch {
			pushToast({ title: '复制失败', tone: 'danger' });
		}
	}

	function exportOut() {
		if (!lastTask) return;
		downloadText(`${lastTask.toolId}.md`, taskToMarkdown(lastTask));
	}

	async function star(id: ToolId, next: boolean) {
		await toggleFavourite(id, next);
		await refresh();
	}

	onMount(() => {
		void (async () => {
			const session = await getApi().getSession();
			if (!session) {
				needLogin = true;
				tasks = await loadCachedTasks();
				catalog = (await loadCachedCatalog()) ?? {
					items: TOOLS.map((item) => ({ ...item, favourite: false })),
					recent: [],
					favourites: []
				};
				return;
			}
			await refresh();
		})();
	});
</script>

<svelte:head>
	<title>轻心 · AI效率工具箱</title>
</svelte:head>

<section class="mx-auto max-w-5xl space-y-5">
	<a href="/modules" class="inline-flex min-h-11 items-center text-base text-[var(--qx-muted)]"
		>← 返回模块中心</a
	>
	<div>
		<Tag tone="primary">工具辅助 · 示意结果</Tag>
		<h1 class="mt-2 text-3xl font-semibold">AI效率工具箱</h1>
		<p class="mt-2 text-base text-[var(--qx-muted)]">
			在左侧输入，右侧会流式出现结果。不构成专业建议。
		</p>
	</div>

	{#if needLogin}
		<Card>
			<EmptyState title="先登录再使用工具" body="离线时也能阅读缓存里的历史。" icon="spark">
				{#snippet action()}
					<Button href="/login">去登录</Button>
				{/snippet}
			</EmptyState>
		</Card>
	{/if}

	<Tabs bind:value={tab} tabs={['工具', '工作台', '历史']} />

	{#if tab === 0}
		{#if favTools.length}
			<h2 class="text-lg font-semibold">已收藏</h2>
			<div class="grid gap-3 sm:grid-cols-2">
				{#each favTools as item (item.id)}
					<button type="button" class="text-left" onclick={() => openTool(item.id)}>
						<Card>
							<p class="font-medium">{item.name}</p>
							<p class="mt-1 text-sm text-[var(--qx-muted)]">{item.blurb}</p>
						</Card>
					</button>
				{/each}
			</div>
		{/if}
		{#if recentTools.length}
			<h2 class="text-lg font-semibold">最近使用</h2>
			<div class="grid gap-3 sm:grid-cols-2">
				{#each recentTools as item (item.id)}
					<button type="button" class="text-left" onclick={() => openTool(item.id)}>
						<Card>
							<p class="font-medium">{item.name}</p>
							<p class="mt-1 text-sm text-[var(--qx-muted)]">{item.blurb}</p>
						</Card>
					</button>
				{/each}
			</div>
		{/if}
		<h2 class="text-lg font-semibold">全部工具</h2>
		<div class="grid gap-3 sm:grid-cols-2">
			{#each catalog.items as item (item.id)}
				<Card>
					<div class="flex items-start justify-between gap-3">
						<button type="button" class="min-w-0 text-left" onclick={() => openTool(item.id)}>
							<p class="font-medium">{item.name}</p>
							<p class="mt-1 text-sm text-[var(--qx-muted)]">{item.blurb}</p>
						</button>
						<button
							type="button"
							class="min-h-11 shrink-0 text-sm text-[var(--qx-primary)]"
							onclick={() => star(item.id, !item.favourite)}
						>
							{item.favourite ? '取消收藏' : '收藏'}
						</button>
					</div>
				</Card>
			{/each}
		</div>
	{:else if tab === 1}
		<div class="grid gap-4 md:grid-cols-2">
			<Card>
				<p class="text-sm text-[var(--qx-muted)]">输入</p>
				<h2 class="mt-1 text-lg font-semibold">{current?.name ?? '摘要'}</h2>
				{#if toolId === 'summary'}
					<div class="mt-3 flex flex-wrap gap-2">
						{#each summaryKinds as kind (kind.id)}
							<button
								type="button"
								class="min-h-11 rounded-xl px-3 {inputKind === kind.id
									? 'bg-[var(--qx-primary)] text-white'
									: 'bg-[var(--qx-surface)]'}"
								onclick={() => (inputKind = kind.id)}
							>
								{kind.label}
							</button>
						{/each}
					</div>
					{#if inputKind === 'url'}
						<Input class="mt-3" label="链接" bind:value={url} />
					{/if}
					{#if inputKind === 'pdf'}
						<Input class="mt-3" label="文件名" bind:value={filename} placeholder="notes.pdf" />
					{/if}
				{/if}
				{#if toolId === 'resume_jd'}
					<Textarea class="mt-3" label="简历" bind:value={resume} />
					<Textarea class="mt-3" label="职位描述" bind:value={jd} />
				{:else if toolId === 'rename'}
					<Textarea class="mt-3" label="文件名（每行一个）" bind:value={filenames} />
				{:else if toolId === 'polish'}
					<div class="mt-3 flex flex-wrap gap-2">
						{#each POLISH_TONES as item (item)}
							<button
								type="button"
								class="min-h-11 rounded-xl px-3 {tone === item
									? 'bg-[var(--qx-primary)] text-white'
									: 'bg-[var(--qx-surface)]'}"
								onclick={() => (tone = item)}>{item}</button
							>
						{/each}
					</div>
					<Textarea class="mt-3" label="原文" bind:value={text} />
				{:else}
					<Textarea class="mt-3" label="内容" bind:value={text} />
				{/if}
				<div class="mt-4 flex flex-wrap gap-2">
					<Button onclick={() => run()} disabled={pending}>开始</Button>
					<Button variant="ghost" onclick={stopRun} disabled={!pending}>停止</Button>
					{#if toolId === 'meeting'}
						<Button variant="secondary" onclick={() => run('decisions')} disabled={pending}
							>生成决策</Button
						>
					{/if}
				</div>
			</Card>
			<Card>
				<p class="text-sm text-[var(--qx-muted)]">输出</p>
				<div class="mt-3 min-h-40">
					{#if thinking}
						<div class="{SHIMMER_CLASS} rounded-2xl p-4" aria-busy="true" aria-label="思考中">
							<p class="mb-3 font-medium">思考中</p>
							<Skeleton lines={4} />
						</div>
					{:else if stopped}
						<p class="text-[var(--qx-muted)]">已停止</p>
						{#if output}
							<pre class="mt-3 text-base whitespace-pre-wrap">{output}</pre>
						{/if}
					{:else if runError}
						<p role="alert">{runError}</p>
						{#if output}
							<pre class="mt-3 text-base whitespace-pre-wrap">{output}</pre>
						{/if}
					{:else if output}
						<pre class="text-base whitespace-pre-wrap">{output}</pre>
					{:else}
						<p class="text-[var(--qx-muted)]">结果会出现在这里</p>
					{/if}
				</div>
				<div class="mt-4 flex flex-wrap gap-2">
					<Button variant="secondary" onclick={copyOut} disabled={!output}>复制</Button>
					<Button variant="secondary" onclick={exportOut} disabled={!lastTask}>导出</Button>
					<Button
						variant="ghost"
						onclick={() => (lastInput ? run(lastInput.step) : run())}
						disabled={pending}>重试</Button
					>
				</div>
				<p class="mt-3 text-sm text-[var(--qx-muted)]">{lastTask?.disclaimer ?? DISCLAIMER}</p>
			</Card>
		</div>
	{:else}
		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				class="min-h-11 rounded-xl px-3 {historyTool === 'all'
					? 'bg-[var(--qx-primary)] text-white'
					: 'bg-[var(--qx-surface)]'}"
				onclick={() => selectHistoryTool('all')}>全部</button
			>
			{#each TOOLS as item (item.id)}
				<button
					type="button"
					class="min-h-11 rounded-xl px-3 {historyTool === item.id
						? 'bg-[var(--qx-primary)] text-white'
						: 'bg-[var(--qx-surface)]'}"
					onclick={() => selectHistoryTool(item.id)}>{item.name}</button
				>
			{/each}
		</div>
		{#if history.length === 0}
			<EmptyState
				title="还没有记录"
				body="跑过一次工具后，会按时间和工具出现在这里。"
				icon="spark"
			/>
		{:else}
			{#each historyGroups as bucket (bucket.id)}
				<h2 class="text-lg font-semibold">{bucket.label}</h2>
				<ul class="space-y-3">
					{#each bucket.items as item (item.id)}
						<li>
							<Card>
								<p class="font-medium">{TOOLS.find((tool) => tool.id === item.toolId)?.name}</p>
								<p class="mt-1 text-sm text-[var(--qx-muted)]">{item.createdAt}</p>
								<p class="mt-2 line-clamp-3 text-base">{item.outputText}</p>
							</Card>
						</li>
					{/each}
				</ul>
			{/each}
		{/if}
	{/if}
</section>

<style>
	.qx-shimmer {
		background: linear-gradient(
			90deg,
			var(--qx-line) 0%,
			var(--qx-surface) 45%,
			var(--qx-line) 100%
		);
		background-size: 200% 100%;
		animation: qx-shimmer 1.2s ease-in-out infinite;
	}

	@keyframes qx-shimmer {
		0% {
			background-position: 100% 0;
		}
		100% {
			background-position: -100% 0;
		}
	}
</style>

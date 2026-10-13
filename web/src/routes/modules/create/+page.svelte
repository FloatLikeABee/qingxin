<script lang="ts">
	import { onMount } from 'svelte';
	import { getApi } from '#lib/api/mock';
	import type { CreateAiText, CreateOutlineResult, CreateSnippet, Creation } from '#lib/api/types';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Input from '#lib/components/Input.svelte';
	import Tabs from '#lib/components/Tabs.svelte';
	import Tag from '#lib/components/Tag.svelte';
	import Textarea from '#lib/components/Textarea.svelte';
	import { DISCLAIMER } from '#lib/create/ai';
	import {
		INSPIRATION,
		LENGTHS,
		PLATFORMS,
		SNIPPET_KINDS,
		TEMPLATES,
		TONES,
		filterTemplates,
		isCreatePlatform,
		type CreateLength,
		type CreatePlatform,
		type CreateTone,
		type SnippetKind
	} from '#lib/create/catalog';
	import { diffLines } from '#lib/create/diff';
	import { EDITOR_CLASS, EDITOR_COLORS, highlightVariables } from '#lib/create/editor';
	import {
		downloadBytes,
		downloadText,
		outlineToMarkdown,
		outlineToPptx
	} from '#lib/create/export';
	import PlatformPreview from '#lib/create/PlatformPreview.svelte';
	import {
		cacheCreations,
		cacheSnippets,
		loadCachedCreations,
		loadCachedSnippets,
		saveCreation
	} from '#lib/create/store';
	import { pushToast } from '#lib/toast';

	let tab = $state(0);
	let pane = $state<'edit' | 'preview'>('edit');
	let needLogin = $state(false);
	let pending = $state(false);
	let platform = $state<CreatePlatform>('小红书');
	let topic = $state('阳台种菜');
	let keywords = $state('番茄, 阳光');
	let tone = $state<CreateTone>('更专业');
	let length = $state<CreateLength>('短');
	let generated = $state('');
	let finalContent = $state('');
	let titles = $state<string[]>([]);
	let aiNote = $state<CreateAiText | null>(null);
	let outline = $state<CreateOutlineResult | null>(null);
	let templateFilter = $state<CreatePlatform | ''>('');
	let works = $state<Creation[]>([]);
	let snippets = $state<CreateSnippet[]>([]);
	let snippetDraft = $state('把结论写在第一句。');
	let snippetKind = $state<SnippetKind>('金句');
	let activeWorkId = $state('');

	const templates = $derived(filterTemplates(TEMPLATES, templateFilter));
	const hunks = $derived(diffLines(generated, finalContent));
	const templateParts = $derived(
		highlightVariables(TEMPLATES.find((item) => item.platform === platform)?.body ?? '')
	);
	const previewTitle = $derived(topic.trim() || '未命名草稿');

	onMount(() => {
		void (async () => {
			const session = await getApi().getSession();
			if (!session) {
				needLogin = true;
				works = await loadCachedCreations();
				snippets = await loadCachedSnippets();
				return;
			}
			try {
				works = await getApi().listCreations();
				snippets = await getApi().listCreateSnippets();
				await cacheCreations(works);
				await cacheSnippets(snippets);
			} catch {
				works = await loadCachedCreations();
				snippets = await loadCachedSnippets();
			}
			const params = new URLSearchParams(window.location.search);
			const nextPlatform = params.get('platform');
			if (nextPlatform && isCreatePlatform(nextPlatform)) platform = nextPlatform;
			if (!generated) {
				await runGenerate();
			}
		})();
	});

	function keywordList() {
		return keywords
			.split(/[,，、\s]+/)
			.map((item) => item.trim())
			.filter(Boolean);
	}

	async function runGenerate() {
		pending = true;
		try {
			const result = await getApi().generateCreateCopy({
				platform,
				topic: topic.trim() || '未命名主题',
				keywords: keywordList(),
				tone,
				length
			});
			aiNote = result;
			generated = result.text;
			finalContent = result.text;
		} catch {
			pushToast({ title: '示意文案暂时不可用', tone: 'danger' });
		}
		pending = false;
	}

	async function runTitles() {
		pending = true;
		try {
			const result = await getApi().generateCreateTitles({
				topic: topic.trim() || '未命名主题',
				platform
			});
			titles = result.titles;
			aiNote = {
				text: result.titles.join('\n'),
				disclaimer: result.disclaimer,
				source: result.source
			};
		} catch {
			pushToast({ title: '标题还没写出来', tone: 'danger' });
		}
		pending = false;
	}

	async function runPolish(next: CreateTone) {
		if (!finalContent.trim()) return;
		pending = true;
		try {
			const result = await getApi().polishCreateCopy({ text: finalContent, tone: next });
			aiNote = result;
			finalContent = result.text;
			if (activeWorkId) {
				try {
					const saved = await getApi().patchCreation(activeWorkId, {
						finalContent: result.text
					});
					works = [saved, ...works.filter((item) => item.id !== saved.id)];
					await cacheCreations(works);
				} catch {
					pushToast({ title: '润色已写进编辑区，保存后会记一版', tone: 'info' });
				}
			}
		} catch {
			pushToast({ title: '润色暂时不可用', tone: 'danger' });
		}
		pending = false;
	}

	async function runOutline() {
		pending = true;
		try {
			outline = await getApi().generateCreateOutline({ topic: topic.trim() || '未命名主题' });
			aiNote = {
				text: outline.markdown,
				disclaimer: outline.disclaimer,
				source: outline.source
			};
			tab = 0;
			pane = 'preview';
		} catch {
			pushToast({ title: '大纲暂时不可用', tone: 'danger' });
		}
		pending = false;
	}

	async function persistWork() {
		if (!generated.trim() && !finalContent.trim()) {
			pushToast({ title: '请先生成一稿', tone: 'danger' });
			return;
		}
		const previous = works;
		try {
			const saved = await saveCreation(
				{
					id: activeWorkId || undefined,
					platform,
					title: topic.trim(),
					promptParams: { topic: topic.trim(), keywords: keywordList(), tone, length },
					generatedContent: generated || finalContent,
					finalContent: finalContent || generated
				},
				(row) => {
					works = [row, ...works];
				},
				() => {
					works = previous;
				}
			);
			works = [saved, ...previous.filter((item) => item.id !== saved.id)];
			activeWorkId = saved.id;
			await cacheCreations(works);
			pushToast({ title: '已收进作品', tone: 'success' });
			tab = 2;
		} catch {
			pushToast({ title: '作品会在联网后同步', tone: 'danger' });
		}
	}

	async function useTemplate(id: string) {
		const found = TEMPLATES.find((item) => item.id === id);
		if (!found) return;
		platform = found.platform;
		tab = 0;
		pane = 'edit';
		pushToast({ title: `已套用「${found.name}」`, tone: 'success' });
	}

	function useInspiration(topicText: string, nextPlatform: CreatePlatform) {
		topic = topicText;
		platform = nextPlatform;
		activeWorkId = '';
		tab = 0;
		void runGenerate();
	}

	function openWork(work: Creation) {
		activeWorkId = work.id;
		platform = work.platform;
		topic = work.title || String(work.promptParams?.topic ?? '');
		generated = work.generatedContent;
		finalContent = work.finalContent;
		tab = 0;
	}

	async function addSnippet() {
		try {
			const saved = await getApi().createSnippet({
				content: snippetDraft,
				kind: snippetKind,
				tags: [snippetKind]
			});
			snippets = [saved, ...snippets.filter((item) => item.id !== saved.id)];
			await cacheSnippets(snippets);
			pushToast({ title: '已放进片段库', tone: 'success' });
		} catch {
			pushToast({ title: '片段还没记下', tone: 'danger' });
		}
	}

	async function insertSnippet(id: string) {
		try {
			const used = await getApi().useSnippet(id);
			snippets = snippets.map((item) => (item.id === id ? used : item));
			finalContent = `${finalContent.trim()}\n${used.content}`.trim();
			await cacheSnippets(snippets);
			tab = 0;
			pane = 'edit';
		} catch {
			pushToast({ title: '没能插入这段', tone: 'danger' });
		}
	}

	function copyText(value: string) {
		void navigator.clipboard?.writeText(value);
		pushToast({ title: '已复制', tone: 'success' });
	}

	function exportMarkdown() {
		const doc = outline
			? outlineToMarkdown(outline)
			: `# ${previewTitle}\n\n${finalContent || generated}`;
		downloadText(`${previewTitle}.md`, doc);
	}

	function exportPptx() {
		const payload = outline ?? {
			title: previewTitle,
			slides: [
				{ heading: previewTitle, bullets: [finalContent || generated || '示意'] },
				{ heading: '要点', bullets: keywordList() },
				{ heading: '下一步', bullets: ['发出去前再读一遍'] }
			]
		};
		downloadBytes(
			`${previewTitle}.pptx`,
			outlineToPptx(payload),
			'application/vnd.openxmlformats-officedocument.presentationml.presentation'
		);
	}
</script>

<svelte:head>
	<title>轻心 · 内容创作</title>
</svelte:head>

<section class="mx-auto max-w-5xl space-y-5 pb-8">
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div>
			<Tag tone="primary">工具辅助 · 示意文案</Tag>
			<h1 class="mt-3 text-3xl font-semibold">内容创作</h1>
			<p class="mt-2 max-w-xl text-base text-[var(--qx-muted)]">
				选一个场景，写下主题，生成后再润色。不构成专业文案或营销建议。
			</p>
		</div>
		<Button href="/modules" variant="secondary">返回模块中心</Button>
	</div>

	{#if needLogin}
		<Card>
			<EmptyState title="登录后才能生成" body="示意文案会保存在本机，方便离线改一版。" icon="spark">
				{#snippet action()}
					<Button href="/login">去登录</Button>
				{/snippet}
			</EmptyState>
		</Card>
	{/if}

	<Tabs tabs={['创作', '模板', '作品']} bind:value={tab} />

	{#if tab === 0}
		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				class="min-h-11 rounded-full px-4 text-sm {pane === 'edit'
					? 'bg-[var(--qx-primary)] text-white'
					: 'bg-[var(--qx-surface)]'}"
				onclick={() => (pane = 'edit')}>编辑</button
			>
			<button
				type="button"
				class="min-h-11 rounded-full px-4 text-sm {pane === 'preview'
					? 'bg-[var(--qx-primary)] text-white'
					: 'bg-[var(--qx-surface)]'}"
				onclick={() => (pane = 'preview')}>预览</button
			>
		</div>
		<div class="grid gap-4 lg:grid-cols-2">
			<div class="space-y-4">
				<Card>
					<h2 class="text-lg font-semibold">场景</h2>
					<div class="mt-3 flex flex-wrap gap-2">
						{#each PLATFORMS as item (item)}
							<button
								type="button"
								class="min-h-11 rounded-full px-4 text-sm {platform === item
									? 'bg-[var(--qx-primary)] text-white'
									: 'bg-[var(--qx-surface)]'}"
								onclick={() => (platform = item)}>{item}</button
							>
						{/each}
					</div>
					<div class="mt-4 grid gap-3 sm:grid-cols-2">
						<Input label="主题" bind:value={topic} />
						<Input label="关键词" bind:value={keywords} hint="逗号分隔" />
					</div>
					<div class="mt-3 flex flex-wrap gap-2">
						{#each TONES as item (item)}
							<button
								type="button"
								class="min-h-11 rounded-full px-3 text-sm {tone === item
									? 'bg-[var(--qx-card)] ring-2 ring-[var(--qx-primary)]'
									: 'bg-[var(--qx-surface)]'}"
								onclick={() => (tone = item)}>{item}</button
							>
						{/each}
						{#each LENGTHS as item (item)}
							<button
								type="button"
								class="min-h-11 rounded-full px-3 text-sm {length === item
									? 'bg-[var(--qx-card)] ring-2 ring-[var(--qx-primary)]'
									: 'bg-[var(--qx-surface)]'}"
								onclick={() => (length = item)}>{item}</button
							>
						{/each}
					</div>
					<div class="mt-4 flex flex-wrap gap-2">
						<Button onclick={runGenerate} disabled={pending}>生成</Button>
						<Button variant="secondary" onclick={runTitles} disabled={pending}>10 个标题</Button>
						<Button variant="secondary" onclick={runOutline} disabled={pending}>PPT 大纲</Button>
					</div>
				</Card>
				<div
					class="{EDITOR_CLASS} rounded-3xl p-4"
					style="background:{EDITOR_COLORS.background};color:{EDITOR_COLORS.text};color-scheme:dark"
				>
					<p class="text-xs tracking-[0.2em] text-slate-400">IDE 深色编辑区</p>
					<p class="mt-2 text-sm text-slate-400">
						{#each templateParts as part, index (index)}
							{#if part.kind === 'variable'}
								<span style="color:{EDITOR_COLORS.variable}">{part.text}</span>
							{:else}
								<span>{part.text}</span>
							{/if}
						{/each}
					</p>
					<label class="mt-3 block text-sm" for="create-final">定稿</label>
					<textarea
						id="create-final"
						class="mt-2 min-h-40 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none"
						bind:value={finalContent}></textarea>
					<div class="mt-3 flex flex-wrap gap-2">
						{#each TONES as item (item)}
							<Button variant="ghost" onclick={() => runPolish(item)} disabled={pending}
								>{item}</Button
							>
						{/each}
						<Button variant="secondary" onclick={() => copyText(finalContent)}>复制</Button>
						<Button onclick={persistWork}>保存作品</Button>
					</div>
				</div>
				{#if hunks.length}
					<Card>
						<h2 class="text-lg font-semibold">生成稿 / 定稿 diff</h2>
						<pre class="mt-3 overflow-x-auto text-sm leading-6">
{#each hunks as hunk, index (index)}<span
									class={hunk.type === 'add'
										? 'block bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
										: hunk.type === 'remove'
											? 'block bg-rose-500/15 text-rose-800 dark:text-rose-200'
											: 'block'}
									>{hunk.type === 'add' ? '+' : hunk.type === 'remove' ? '-' : ' '}{hunk.text}</span
								>{/each}</pre>
					</Card>
				{/if}
			</div>
			<div class="space-y-4 {pane === 'edit' ? 'max-lg:hidden' : ''}">
				<Card>
					<h2 class="text-lg font-semibold">平台预览</h2>
					<p class="mt-1 text-sm text-[var(--qx-muted)]">示意排版，不是真实发布页。</p>
					<div class="mt-4">
						<PlatformPreview {platform} title={previewTitle} body={finalContent || generated} />
					</div>
				</Card>
				{#if titles.length}
					<Card>
						<h2 class="text-lg font-semibold">标题候选</h2>
						<ul class="mt-3 space-y-2">
							{#each titles as item (item)}
								<li>
									<button
										type="button"
										class="min-h-11 w-full rounded-2xl bg-[var(--qx-surface)] px-4 text-left"
										onclick={() => (topic = item)}>{item}</button
									>
								</li>
							{/each}
						</ul>
					</Card>
				{/if}
				{#if outline}
					<Card>
						<h2 class="text-lg font-semibold">PPT 大纲</h2>
						<p class="mt-2 text-sm text-[var(--qx-muted)]">{outline.title}</p>
						<div class="mt-3 flex flex-wrap gap-2">
							<Button variant="secondary" onclick={exportMarkdown}>导出 Markdown</Button>
							<Button variant="secondary" onclick={exportPptx}>导出 PPTX</Button>
						</div>
						<pre class="mt-3 overflow-x-auto text-sm whitespace-pre-wrap">{outline.markdown}</pre>
					</Card>
				{/if}
			</div>
		</div>
		{#if aiNote}
			<p class="text-sm text-[var(--qx-muted)]">{aiNote.disclaimer} · {aiNote.source}</p>
		{:else}
			<p class="text-sm text-[var(--qx-muted)]">{DISCLAIMER}</p>
		{/if}
	{:else if tab === 1}
		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				class="min-h-11 rounded-full px-4 {templateFilter === ''
					? 'bg-[var(--qx-primary)] text-white'
					: 'bg-[var(--qx-surface)]'}"
				onclick={() => (templateFilter = '')}>全部</button
			>
			{#each PLATFORMS as item (item)}
				<button
					type="button"
					class="min-h-11 rounded-full px-4 {templateFilter === item
						? 'bg-[var(--qx-primary)] text-white'
						: 'bg-[var(--qx-surface)]'}"
					onclick={() => (templateFilter = item)}>{item}</button
				>
			{/each}
		</div>
		<p class="text-sm text-[var(--qx-muted)]">一键使用会把平台和提示词带回创作页。</p>
		<div class="grid gap-3 md:grid-cols-2">
			{#each templates as item (item.id)}
				<Card>
					<Tag>{item.platform}</Tag>
					<h2 class="mt-2 text-lg font-semibold">{item.name}</h2>
					<pre class="mt-3 text-sm whitespace-pre-wrap text-[var(--qx-muted)]">{item.body}</pre>
					<Button class="mt-4" onclick={() => useTemplate(item.id)}>使用</Button>
				</Card>
			{/each}
		</div>
	{:else}
		<div class="grid gap-4 lg:grid-cols-2">
			<Card>
				<h2 class="text-lg font-semibold">作品</h2>
				<p class="mt-1 text-sm text-[var(--qx-muted)]">版本历史与导出。</p>
				{#if works.length === 0}
					<p class="mt-4 text-sm text-[var(--qx-muted)]">还没有作品。生成一稿后点保存。</p>
				{:else}
					<ul class="mt-4 space-y-3">
						{#each works as work (work.id)}
							<li class="rounded-2xl bg-[var(--qx-surface)] p-4">
								<button type="button" class="w-full text-left" onclick={() => openWork(work)}>
									<p class="font-medium">{work.title || work.platform}</p>
									<p class="text-sm text-[var(--qx-muted)]">
										{work.platform} · {work.versions.length} 个版本
									</p>
								</button>
								{#if activeWorkId === work.id}
									<ol class="mt-3 space-y-1 text-sm text-[var(--qx-muted)]">
										{#each work.versions as version, index (index)}
											<li>{version.kind} · {version.content.slice(0, 36)}</li>
										{/each}
									</ol>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
				<div class="mt-4 flex flex-wrap gap-2">
					<Button variant="secondary" onclick={exportMarkdown}>导出 Markdown</Button>
					<Button variant="secondary" onclick={exportPptx}>导出 PPTX</Button>
				</div>
			</Card>
			<Card>
				<h2 class="text-lg font-semibold">片段库</h2>
				<div class="mt-3 flex flex-wrap gap-2">
					{#each SNIPPET_KINDS as item (item)}
						<button
							type="button"
							class="min-h-11 rounded-full px-3 text-sm {snippetKind === item
								? 'bg-[var(--qx-primary)] text-white'
								: 'bg-[var(--qx-surface)]'}"
							onclick={() => (snippetKind = item)}>{item}</button
						>
					{/each}
				</div>
				<Textarea class="mt-3" label="新片段" bind:value={snippetDraft} />
				<Button class="mt-3" onclick={addSnippet}>收下这段</Button>
				<ul class="mt-4 space-y-2">
					{#each snippets as item (item.id)}
						<li
							class="flex items-start justify-between gap-3 rounded-2xl bg-[var(--qx-surface)] px-4 py-3"
						>
							<div>
								<p>{item.content}</p>
								<p class="text-sm text-[var(--qx-muted)]">
									{item.kind} · 用过 {item.usageCount} 次
								</p>
							</div>
							<Button variant="ghost" onclick={() => insertSnippet(item.id)}>插入</Button>
						</li>
					{/each}
				</ul>
			</Card>
		</div>
	{/if}

	{#if tab === 0}
		<div class="grid gap-3 sm:grid-cols-2">
			{#each INSPIRATION as item (item.id)}
				<button
					type="button"
					class="rounded-3xl bg-[var(--qx-card)] p-4 text-left ring-1 ring-[var(--qx-line)]"
					onclick={() => useInspiration(item.topic, item.platform)}
				>
					<Tag>{item.platform}</Tag>
					<p class="mt-2 font-medium">{item.topic}</p>
					<p class="text-sm text-[var(--qx-muted)]">{item.hook}</p>
				</button>
			{/each}
		</div>
	{/if}
</section>

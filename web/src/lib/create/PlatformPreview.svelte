<script lang="ts">
	import type { CreatePlatform } from './catalog';

	let {
		platform,
		title,
		body
	}: {
		platform: CreatePlatform;
		title: string;
		body: string;
	} = $props();

	const previewTitle = $derived(title.trim() || '未命名草稿');
	const previewBody = $derived(body.trim() || '生成后会在这里看到平台样式。');
</script>

{#if platform === '小红书'}
	<article class="create-preview-xhs overflow-hidden rounded-3xl bg-white text-zinc-900 shadow-lg">
		<div
			class="flex aspect-[4/5] items-end bg-gradient-to-br from-rose-200 via-orange-100 to-amber-50 p-4"
		>
			<p class="text-lg leading-snug font-semibold">{previewTitle}</p>
		</div>
		<div class="space-y-2 p-4">
			<p class="text-sm font-medium">轻心同学</p>
			<p class="text-sm leading-relaxed whitespace-pre-wrap text-zinc-600">{previewBody}</p>
			<p class="text-xs text-zinc-400">小红书卡片 · 示意</p>
		</div>
	</article>
{:else if platform === '公众号'}
	<article class="create-preview-mp mx-auto max-w-md bg-white px-5 py-6 text-zinc-900 shadow-sm">
		<h3 class="text-2xl leading-snug font-semibold">{previewTitle}</h3>
		<p class="mt-2 text-sm text-zinc-400">轻心同学 · 公众号排版示意</p>
		<p class="mt-4 text-base leading-8 whitespace-pre-wrap text-zinc-700">{previewBody}</p>
	</article>
{:else if platform === '抖音'}
	<article
		class="create-preview-dy relative mx-auto aspect-[9/16] max-h-[28rem] w-52 overflow-hidden rounded-[2rem] bg-zinc-950 text-white"
	>
		<div class="absolute inset-0 bg-gradient-to-t from-black via-zinc-800 to-zinc-600"></div>
		<div class="absolute right-3 bottom-16 space-y-4 text-center text-xs">
			<p>♡</p>
			<p>评</p>
			<p>转</p>
		</div>
		<div class="absolute right-4 bottom-6 left-4">
			<p class="font-medium">@轻心同学</p>
			<p class="mt-1 text-sm leading-snug">{previewTitle}</p>
			<p class="mt-2 line-clamp-4 text-xs text-zinc-200">{previewBody}</p>
		</div>
	</article>
{:else}
	<article
		class="create-preview-weekly rounded-2xl bg-white p-5 text-zinc-900 ring-1 ring-zinc-200"
	>
		<p class="text-xs tracking-[0.3em] text-zinc-400">WEEKLY</p>
		<h3 class="mt-2 text-xl font-semibold">{previewTitle}</h3>
		<p class="mt-4 text-sm leading-7 whitespace-pre-wrap text-zinc-700">{previewBody}</p>
	</article>
{/if}

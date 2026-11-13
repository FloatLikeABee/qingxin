<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Tag from '#lib/components/Tag.svelte';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import GameCover from '#lib/games/GameCover.svelte';
	import { playHref } from '#lib/games/catalog';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const playable = $derived(data.game.status === 'playable');
</script>

<svelte:head>
	<title>轻心 · {data.game.title}</title>
</svelte:head>

<section class="mx-auto max-w-5xl min-w-0">
	<a href="/modules/games" class="{LINK_CLASS} mb-4">← 返回目录</a>

	<div class="mt-4 overflow-hidden rounded-3xl ring-1 ring-[var(--qx-line)]">
		<GameCover cover={data.game.cover} title={data.game.title} class="h-56 w-full md:h-80" />
	</div>

	<p class="mt-5 text-sm text-[var(--qx-muted)]">{data.game.category}</p>
	<h1 class="mt-1 font-[Outfit] text-3xl font-semibold tracking-tight">{data.game.title}</h1>
	{#if data.game.englishTitle}
		<p class="mt-1 text-base text-[var(--qx-muted)]">{data.game.englishTitle}</p>
	{/if}

	<div class="mt-3 flex flex-wrap gap-1">
		{#each data.game.tags as tag (tag)}
			<Tag>{tag}</Tag>
		{/each}
		{#if !playable}
			<Tag>即将到来</Tag>
		{/if}
	</div>

	<h2 class="mt-8 text-lg font-semibold">关于这款游戏</h2>
	<p class="mt-2 max-w-2xl text-base leading-7 text-[var(--qx-muted)]">{data.game.about}</p>

	<div class="mt-8">
		{#if playable}
			<Button href={playHref(data.game)}>{data.game.playCta}</Button>
		{:else}
			<Button disabled>即将到来</Button>
		{/if}
	</div>
</section>

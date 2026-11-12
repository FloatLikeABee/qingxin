<script lang="ts">
	import { LINK_CLASS } from '#lib/ui/affordance';
	import GameCover from '#lib/games/GameCover.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>轻心 · {data.game.title}</title>
</svelte:head>

<section class="mx-auto flex min-h-[70dvh] max-w-5xl min-w-0 flex-col px-5 py-5">
	<a href="/modules/games" class="{LINK_CLASS} mb-4">← 返回目录</a>
	<h1 class="font-[Outfit] text-2xl font-semibold">{data.game.title}</h1>
	<p class="mt-1 text-base text-[var(--qx-muted)]">店面还在布置货架。目录可以先逛。</p>
	<div class="mt-6 min-h-64 overflow-hidden rounded-3xl ring-1 ring-[var(--qx-line)]">
		<GameCover cover={data.game.cover} title={data.game.title} class="h-64 w-full" />
	</div>
</section>

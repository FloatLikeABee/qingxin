<script lang="ts">
	import Tag from '#lib/components/Tag.svelte';
	import { gameHref, type GameInfo } from './catalog';
	import GameCover from './GameCover.svelte';

	let { game }: { game: GameInfo } = $props();
</script>

<a
	href={gameHref(game)}
	class="game-card group flex min-h-0 min-w-0 flex-col overflow-hidden rounded-3xl bg-[var(--qx-card)] ring-1 ring-[var(--qx-line)] transition duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qx-primary)] motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[0_22px_40px_-28px_rgba(15,23,42,0.55)]"
>
	<div class="relative h-40 min-w-0 overflow-hidden">
		<GameCover
			cover={game.cover}
			title={game.title}
			class="h-full w-full motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105"
		/>
		<span
			class="absolute top-2 left-2 rounded-full bg-[color-mix(in_srgb,var(--qx-card)_88%,transparent)] px-2.5 py-1 text-sm text-[var(--qx-text)] backdrop-blur-sm"
		>
			{game.category}
		</span>
		{#if game.status === 'coming'}
			<span
				class="absolute top-2 right-2 rounded-full bg-[color-mix(in_srgb,var(--qx-bg)_82%,transparent)] px-2.5 py-1 text-sm text-[var(--qx-muted)]"
			>
				即将到来
			</span>
		{/if}
	</div>
	<div class="flex min-w-0 flex-1 flex-col p-4">
		<h3 class="text-base font-semibold text-[var(--qx-text)]">{game.title}</h3>
		<p class="mt-1 line-clamp-2 text-sm text-[var(--qx-muted)]">{game.summary}</p>
		<div class="mt-3 flex flex-wrap gap-1">
			{#each game.tags.slice(0, 3) as tag (tag)}
				<Tag>{tag}</Tag>
			{/each}
		</div>
	</div>
</a>

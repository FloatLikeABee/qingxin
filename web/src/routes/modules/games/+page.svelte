<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import GameCard from '#lib/games/GameCard.svelte';
	import GameCover from '#lib/games/GameCover.svelte';
	import { featuredGame, GAME_CATEGORIES, GAMES, gameHref, playHref } from '#lib/games/catalog';
	import { filterGames } from '#lib/games/filter';

	const featured = featuredGame();
	let search = $state('');
	let category = $state<(typeof GAME_CATEGORIES)[number]>('全部');
	const visible = $derived(filterGames(GAMES, { search, category }));

	const tiles: { id: (typeof GAME_CATEGORIES)[number]; icon: string; wash: string }[] = [
		{
			id: '经营',
			icon: 'wallet',
			wash: 'linear-gradient(135deg, var(--qx-accent-coral), var(--qx-accent-gold))'
		},
		{
			id: '休闲',
			icon: 'cloud',
			wash: 'linear-gradient(135deg, var(--qx-primary), color-mix(in srgb, var(--qx-primary) 45%, white))'
		},
		{
			id: '益智',
			icon: 'spark',
			wash: 'linear-gradient(135deg, var(--qx-accent-teal), color-mix(in srgb, var(--qx-accent-teal) 55%, var(--qx-primary)))'
		},
		{
			id: '节奏',
			icon: 'pulse',
			wash: 'linear-gradient(135deg, var(--qx-accent-gold), var(--qx-accent-coral))'
		}
	];

	function chooseCategory(next: (typeof GAME_CATEGORIES)[number]) {
		category = category === next ? '全部' : next;
	}
</script>

<svelte:head>
	<title>轻心 · 游戏</title>
</svelte:head>

<section class="games-catalog mx-auto max-w-5xl min-w-0">
	<a href="/modules" class="{LINK_CLASS} mb-3">← 返回模块中心</a>

	<header
		class="games-hero mt-3 flex flex-col gap-4 rounded-3xl bg-[color-mix(in_srgb,var(--qx-card)_78%,transparent)] px-4 py-4 ring-1 ring-[var(--qx-line)] sm:flex-row sm:items-center sm:justify-between"
	>
		<div class="min-w-0">
			<h1 class="font-[Outfit] text-3xl font-semibold tracking-tight">轻心游戏</h1>
			<p class="mt-1 max-w-md text-base text-[var(--qx-muted)]">进一间小店，过完一个班次。</p>
		</div>
		{#if featured}
			<a
				href={playHref(featured)}
				class="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[var(--qx-primary)] px-5 text-base font-medium text-white shadow-[0_12px_30px_-16px_var(--qx-primary)] transition duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qx-primary)] motion-safe:hover:scale-[1.03]"
			>
				去玩{featured.title}
			</a>
		{/if}
	</header>

	<section class="mt-5">
		<h2 class="text-lg font-semibold">按类型逛</h2>
		<div class="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
			{#each tiles as tile (tile.id)}
				<button
					type="button"
					class="group relative min-h-20 overflow-hidden rounded-2xl px-3 py-3 text-left text-white transition duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qx-primary)] motion-safe:hover:scale-[1.04] {category ===
					tile.id
						? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--qx-bg)]'
						: ''}"
					style="background:{tile.wash}"
					aria-pressed={category === tile.id}
					onclick={() => chooseCategory(tile.id)}
				>
					<Icon
						name={tile.icon}
						class="mb-1 h-6 w-6 motion-safe:transition-transform motion-safe:group-hover:rotate-12"
					/>
					<span class="block text-sm font-semibold">{tile.id}</span>
				</button>
			{/each}
		</div>
	</section>

	<form class="relative mt-5 max-w-xl" onsubmit={(event) => event.preventDefault()}>
		<label class="sr-only" for="game-search">找一款想玩的</label>
		<input
			id="game-search"
			type="search"
			bind:value={search}
			placeholder="找一款想玩的"
			class="min-h-11 w-full rounded-2xl border border-[var(--qx-line)] bg-[var(--qx-card)] py-2 pr-4 pl-11 text-base text-[var(--qx-text)] outline-none placeholder:text-[var(--qx-muted)] focus:ring-2 focus:ring-[var(--qx-primary)]"
		/>
		<span
			class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--qx-muted)]"
		>
			<Icon name="spark" />
		</span>
	</form>

	{#if featured && !search.trim() && (category === '全部' || featured.category === category)}
		<article
			class="mt-5 overflow-hidden rounded-3xl bg-[var(--qx-card)] ring-1 ring-[var(--qx-line)] md:grid md:grid-cols-2"
		>
			<a
				href={gameHref(featured)}
				class="block min-h-48 min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qx-primary)]"
			>
				<GameCover cover={featured.cover} title={featured.title} class="h-52 w-full md:h-full" />
			</a>
			<div class="flex min-w-0 flex-col justify-center p-5">
				<p class="text-sm text-[var(--qx-muted)]">精选 {featured.category}</p>
				<h2 class="mt-1 text-2xl font-semibold">{featured.title}</h2>
				<p class="mt-2 text-base text-[var(--qx-muted)]">{featured.summary}</p>
				<div class="mt-4 flex flex-wrap gap-2">
					<a
						href={playHref(featured)}
						class="inline-flex min-h-11 items-center rounded-2xl bg-[var(--qx-primary)] px-5 text-base font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qx-primary)]"
					>
						开始经营
					</a>
					<a
						href={gameHref(featured)}
						class="inline-flex min-h-11 items-center rounded-2xl px-5 text-base text-[var(--qx-primary)] underline decoration-[var(--qx-primary)] underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qx-primary)]"
					>
						先看介绍
					</a>
				</div>
			</div>
		</article>
	{/if}

	<div class="mt-6 mb-2 flex items-end justify-between gap-3">
		<h2 class="text-lg font-semibold">全部游戏</h2>
		<p class="text-sm text-[var(--qx-muted)]">{visible.length} 款</p>
	</div>

	{#if visible.length === 0}
		<p
			class="rounded-3xl bg-[var(--qx-card)] px-4 py-10 text-center text-base text-[var(--qx-muted)] ring-1 ring-[var(--qx-line)]"
		>
			没有找到这款游戏。换个词，或看全部。
		</p>
	{:else}
		<div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
			{#each visible as game (game.id)}
				<GameCard {game} />
			{/each}
		</div>
	{/if}
</section>

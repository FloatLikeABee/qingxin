<script lang="ts">
	import FloristPlay from '#lib/games/florist/FloristPlay.svelte';
	import NightPlay from '#lib/games/night/NightPlay.svelte';
	import StorePlay from '#lib/games/store/StorePlay.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

{#if data.game.id === 'corner-florist'}
	<FloristPlay title={data.game.title} />
{:else if data.game.id === 'night-puzzle'}
	<NightPlay title={data.game.title} />
{:else}
	<StorePlay title={data.game.title} />
{/if}

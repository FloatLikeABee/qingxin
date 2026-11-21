<script lang="ts">
	import GardenPlay from '#lib/games/garden/GardenPlay.svelte';
	import ShooterPlay from '#lib/games/shooter/ShooterPlay.svelte';
	import StorePlay from '#lib/games/store/StorePlay.svelte';
	import CloudPlay from '#lib/games/cloud/CloudPlay.svelte';
	import ShelfPlay from '#lib/games/shelf/ShelfPlay.svelte';
	import TidePlay from '#lib/games/tide/TidePlay.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

{#if data.game.id === 'window-garden'}
	<GardenPlay title={data.game.title} />
{:else if data.game.id === 'sky-sortie'}
	<ShooterPlay title={data.game.title} />
{:else if data.game.id === 'tide-breath'}
	<TidePlay title={data.game.title} />
{:else if data.game.id === 'cloud-walk'}
	<CloudPlay title={data.game.title} />
{:else if data.game.id === 'memory-shelf'}
	<ShelfPlay title={data.game.title} />
{:else}
	<StorePlay title={data.game.title} />
{/if}

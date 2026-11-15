<script lang="ts">
	import GardenPlay from '#lib/games/garden/GardenPlay.svelte';
	import ShooterPlay from '#lib/games/shooter/ShooterPlay.svelte';
	import StorePlay from '#lib/games/store/StorePlay.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

{#if data.game.id === 'window-garden'}
	<GardenPlay title={data.game.title} />
{:else if data.game.id === 'sky-sortie'}
	<ShooterPlay title={data.game.title} />
{:else}
	<StorePlay title={data.game.title} />
{/if}

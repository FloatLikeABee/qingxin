<script lang="ts">
	import StorePlay from '#lib/games/store/StorePlay.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<StorePlay title={data.game.title} />

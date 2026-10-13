<script lang="ts">
	import PetsChrome from '#lib/pets/PetsChrome.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<PetsChrome>
	{@render children()}
</PetsChrome>

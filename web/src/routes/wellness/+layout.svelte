<script lang="ts">
	import WellnessChrome from '#lib/wellness/WellnessChrome.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<WellnessChrome>
	{@render children()}
</WellnessChrome>

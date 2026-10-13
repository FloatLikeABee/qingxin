<script lang="ts">
	import { browser } from '$app/env';
	import { onMount } from 'svelte';
	import FinanceChrome from '#lib/finance/FinanceChrome.svelte';
	import { getFinanceStore } from '#lib/finance/store';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	onMount(() => {
		if (!browser) return;
		void getFinanceStore().hydrate();
	});
</script>

<FinanceChrome>
	{@render children()}
</FinanceChrome>

<script lang="ts">
	import { browser } from '$app/env';
	import { onMount } from 'svelte';
	import './layout.css';
	import AppShell from '#lib/components/AppShell.svelte';
	import { readElderMode, syncElderMode } from '#lib/elder/mode';
	import { readStoredMode, syncDocumentTheme } from '#lib/theme/runtime';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	onMount(() => {
		if (!browser) return;
		const apply = () => {
			syncDocumentTheme(readStoredMode());
			syncElderMode(readElderMode());
		};
		apply();
		const media = window.matchMedia('(prefers-color-scheme: dark)');
		media.addEventListener('change', apply);
		const timer = window.setInterval(apply, 60_000);
		return () => {
			media.removeEventListener('change', apply);
			window.clearInterval(timer);
		};
	});
</script>

<svelte:head>
	<title>轻心</title>
</svelte:head>

<AppShell>
	{@render children()}
</AppShell>

<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		tone = 'default',
		children
	}: {
		tone?: 'default' | 'primary' | 'warm';
		children: Snippet;
	} = $props();

	const tones = {
		default: 'bg-[var(--qx-surface)] text-[var(--qx-muted)]',
		primary: 'bg-[color-mix(in_srgb,var(--qx-primary)_16%,transparent)] text-[var(--qx-primary)]',
		warm: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200'
	};
</script>

<span class="inline-flex min-h-8 items-center rounded-full px-3 text-sm font-medium {tones[tone]}">
	{@render children()}
</span>

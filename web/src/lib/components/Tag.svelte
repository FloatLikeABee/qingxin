<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		tone = 'default',
		children
	}: {
		tone?: 'default' | 'primary' | 'warm' | 'applied' | 'interview' | 'offer';
		children: Snippet;
	} = $props();

	const tones = {
		default: 'bg-[var(--qx-surface)] text-[var(--qx-muted)]',
		primary: 'bg-[color-mix(in_srgb,var(--qx-primary)_16%,transparent)] text-[var(--qx-primary)]',
		warm: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
		applied:
			'bg-sky-100 text-sky-800 ring-2 ring-sky-400 dark:bg-sky-500/30 dark:text-sky-100 dark:ring-sky-300',
		interview:
			'bg-amber-100 text-amber-900 ring-2 ring-amber-400 dark:bg-amber-400/30 dark:text-amber-50 dark:ring-amber-200',
		offer:
			'bg-emerald-100 text-emerald-900 ring-2 ring-emerald-400 dark:bg-emerald-400/30 dark:text-emerald-50 dark:ring-emerald-200'
	};
</script>

<span class="inline-flex min-h-8 items-center rounded-full px-3 text-sm font-medium {tones[tone]}">
	{@render children()}
</span>

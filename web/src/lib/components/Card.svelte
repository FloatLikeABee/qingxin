<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		class: className = '',
		padded = true,
		children
	}: {
		class?: string;
		padded?: boolean;
		children: Snippet;
	} = $props();
</script>

<div
	class="rounded-3xl bg-[var(--qx-card)] shadow-[0_18px_50px_-32px_rgba(15,23,42,0.45)] ring-1 ring-[var(--qx-line)] {padded
		? 'p-5'
		: ''} {className}"
>
	{@render children()}
</div>

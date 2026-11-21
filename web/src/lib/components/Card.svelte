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

<div class="qx-glass min-w-0 rounded-3xl {padded ? 'p-5' : ''} {className}">
	{@render children()}
</div>

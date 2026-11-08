<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		class: className = '',
		children
	}: {
		class?: string;
		children: Snippet;
	} = $props();
</script>

<div class="qx-bento-host {className}">
	<div class="qx-bento" data-bento>
		{@render children()}
	</div>
</div>

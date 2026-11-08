<script lang="ts">
	import type { Snippet } from 'svelte';
	import { bentoItemClass, type BentoSpan } from '../ui/bento';

	let {
		span = 'unit',
		class: className = '',
		children
	}: {
		span?: BentoSpan;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<div class="{bentoItemClass(span)} {className}" data-bento-item data-span={span}>
	{@render children()}
</div>

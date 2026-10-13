<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		title,
		body,
		icon = 'info',
		action
	}: {
		title: string;
		body: string;
		icon?: 'info' | 'cloud' | 'spark';
		action?: Snippet;
	} = $props();
</script>

<div class="flex flex-col items-center px-4 py-10 text-center">
	<div
		class="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[color-mix(in_srgb,var(--qx-primary)_14%,transparent)] text-[var(--qx-primary)]"
	>
		<Icon name={icon} class="h-7 w-7" />
	</div>
	<h3 class="text-lg font-semibold">{title}</h3>
	<p class="mt-2 max-w-sm text-base text-[var(--qx-muted)]">{body}</p>
	{#if action}
		<div class="mt-5">
			{@render action()}
		</div>
	{/if}
</div>

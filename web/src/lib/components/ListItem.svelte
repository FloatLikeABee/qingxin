<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		title,
		subtitle,
		href,
		icon = 'chevron',
		onclick,
		trailing
	}: {
		title: string;
		subtitle?: string;
		href?: string;
		icon?: string;
		onclick?: () => void;
		trailing?: Snippet;
	} = $props();

	const classes =
		'flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-[color-mix(in_oklab,var(--qx-card)_42%,transparent)]';
</script>

{#if href}
	<a {href} class={classes}>
		<span
			class="qx-chip flex h-11 w-11 items-center justify-center rounded-2xl text-[var(--qx-primary)]"
		>
			<Icon name={icon as 'home'} />
		</span>
		<span class="min-w-0 flex-1">
			<span class="block text-base font-medium">{title}</span>
			{#if subtitle}
				<span class="block truncate text-sm text-[var(--qx-muted)]">{subtitle}</span>
			{/if}
		</span>
		{#if trailing}
			{@render trailing()}
		{:else}
			<Icon name="chevron" class="h-4 w-4 text-[var(--qx-muted)]" />
		{/if}
	</a>
{:else}
	<button type="button" class={classes} {onclick}>
		<span
			class="qx-chip flex h-11 w-11 items-center justify-center rounded-2xl text-[var(--qx-primary)]"
		>
			<Icon name={icon as 'home'} />
		</span>
		<span class="min-w-0 flex-1">
			<span class="block text-base font-medium">{title}</span>
			{#if subtitle}
				<span class="block truncate text-sm text-[var(--qx-muted)]">{subtitle}</span>
			{/if}
		</span>
		{#if trailing}
			{@render trailing()}
		{/if}
	</button>
{/if}

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

	let {
		variant = 'primary',
		href,
		class: className = '',
		children,
		...rest
	}: {
		variant?: Variant;
		href?: string;
		class?: string;
		children: Snippet;
	} & HTMLButtonAttributes = $props();

	const styles: Record<Variant, string> = {
		primary:
			'bg-[var(--qx-primary)] text-white shadow-[0_12px_30px_-16px_var(--qx-primary)] hover:brightness-105',
		secondary:
			'bg-[var(--qx-card)] text-[var(--qx-text)] ring-1 ring-[var(--qx-line)] hover:bg-[var(--qx-surface)]',
		ghost: 'bg-transparent text-[var(--qx-text)] hover:bg-[var(--qx-card)]',
		danger: 'bg-rose-500 text-white hover:bg-rose-400'
	};

	const classes = $derived(
		[
			'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 text-base font-medium transition duration-200 ease-out',
			'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qx-primary)]',
			'disabled:pointer-events-none disabled:opacity-45 motion-safe:active:scale-[0.98]',
			styles[variant],
			className
		].join(' ')
	);
</script>

{#if href}
	<a {href} class={classes}>
		{@render children()}
	</a>
{:else}
	<button class={classes} {...rest}>
		{@render children()}
	</button>
{/if}

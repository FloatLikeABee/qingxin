<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const links = [
		{ href: '/pets', label: '今日' },
		{ href: '/pets/calendar', label: '日历' },
		{ href: '/pets/services', label: '附近' }
	];
</script>

<section
	class="mx-auto max-w-2xl space-y-5 text-[length:var(--qx-font-size,1rem)] text-[var(--qx-text)]"
>
	<nav class="flex flex-wrap gap-2">
		{#each links as link (link.href)}
			<a
				href={link.href}
				class="inline-flex min-h-11 items-center rounded-2xl bg-[var(--qx-surface)] px-4 text-base"
			>
				{link.label}
			</a>
		{/each}
	</nav>
	{@render children()}
</section>

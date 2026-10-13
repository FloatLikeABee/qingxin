<script lang="ts">
	import type { Snippet } from 'svelte';
	import { financeStyleVars } from './colours';

	let { children }: { children: Snippet } = $props();

	const links = [
		{ href: '/finance', label: '概览' },
		{ href: '/finance/add', label: '记账' },
		{ href: '/finance/report', label: '报表' },
		{ href: '/finance/settings', label: '设置' },
		{ href: '/finance/challenges', label: '挑战' }
	];
</script>

<section
	class="qx-finance mx-auto max-w-2xl space-y-5 text-[length:var(--qx-font-size,1rem)] text-[var(--qx-text)]"
	style={financeStyleVars()}
>
	<a href="/modules" class="inline-flex min-h-11 items-center text-base text-[var(--qx-muted)]"
		>← 返回模块中心</a
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

<style>
	.qx-finance {
		--qx-expense: #dc2626;
		--qx-income: #16a34a;
	}

	:global(.dark) .qx-finance {
		--qx-expense: #fb7185;
		--qx-income: #34d399;
	}
</style>

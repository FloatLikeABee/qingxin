<script lang="ts">
	import type { Snippet } from 'svelte';
	import { LINK_CLASS } from '../ui/affordance';

	let { children }: { children: Snippet } = $props();

	const links = [
		{ href: '/wellness', label: '今日' },
		{ href: '/wellness/record', label: '记录' },
		{ href: '/wellness/stats', label: '统计' },
		{ href: '/wellness/reports', label: '报告' },
		{ href: '/wellness/plans', label: '计划' }
	];
</script>

<section
	class="qx-wellness mx-auto min-w-0 max-w-5xl space-y-5 text-[length:var(--qx-font-size,1rem)] text-[var(--qx-text)]"
>
	<a href="/modules" class={LINK_CLASS}>← 返回模块中心</a>
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

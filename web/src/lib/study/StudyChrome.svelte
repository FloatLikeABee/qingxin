<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const links = [
		{ href: '/study', label: '今日' },
		{ href: '/study/checkin', label: '打卡' },
		{ href: '/study/cards', label: '错题' },
		{ href: '/study/notes', label: '笔记' },
		{ href: '/study/skills', label: '技能树' },
		{ href: '/study/focus', label: '专注' }
	];
</script>

<section
	class="qx-study mx-auto max-w-2xl space-y-5 text-[length:var(--qx-font-size,1rem)] text-[var(--qx-text)]"
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

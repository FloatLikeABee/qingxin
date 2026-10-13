<script lang="ts">
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import { TABS, isTabActive } from '../nav';
	import Icon from './Icon.svelte';
	import OfflineBanner from './OfflineBanner.svelte';
	import PrivacyGate from './PrivacyGate.svelte';
	import Toast from './Toast.svelte';

	let { children }: { children: Snippet } = $props();

	const pathname = $derived(page.url.pathname);
	const hideTabs = $derived(['/login', '/register'].includes(pathname));
</script>

<div class="qx-shell relative min-h-dvh bg-[var(--qx-bg)] text-[var(--qx-text)]">
	<div class="qx-aurora pointer-events-none" aria-hidden="true">
		<div class="qx-orb qx-orb-a"></div>
		<div class="qx-orb qx-orb-b"></div>
	</div>

	<OfflineBanner />
	<PrivacyGate />
	<Toast />

	<div class="relative mx-auto flex min-h-dvh w-full max-w-6xl">
		<aside
			class="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-[var(--qx-line)] px-4 py-6 md:flex"
		>
			<a href="/" class="mb-8 flex items-center gap-2 px-2">
				<span
					class="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--qx-primary)] text-white"
				>
					<Icon name="logo" class="h-6 w-6" />
				</span>
				<span>
					<span class="block font-[Outfit] text-lg font-semibold tracking-wide">轻心</span>
					<span class="text-sm text-[var(--qx-muted)]">把日子过轻一点</span>
				</span>
			</a>
			<nav class="flex flex-1 flex-col gap-1">
				{#each TABS as tab (tab.href)}
					<a
						href={tab.href}
						class="flex min-h-11 items-center gap-3 rounded-2xl px-3 text-base transition {isTabActive(
							pathname,
							tab.href
						)
							? 'bg-[var(--qx-card)] text-[var(--qx-primary)] shadow-sm'
							: 'text-[var(--qx-muted)] hover:bg-[var(--qx-card)]'}"
					>
						<Icon name={tab.icon} />
						{tab.label}
					</a>
				{/each}
			</nav>
			<p class="px-3 text-sm leading-6 text-[var(--qx-muted)]">工具辅助 · 信息展示<br />非医疗 / 非金融 / 非法律建议</p>
		</aside>

		<div class="flex min-w-0 flex-1 flex-col">
			<header class="flex items-center justify-between px-5 pt-5 pb-2 md:hidden">
				<a href="/" class="flex items-center gap-2">
					<span
						class="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--qx-primary)] text-white"
					>
						<Icon name="logo" />
					</span>
					<span class="font-[Outfit] text-lg font-semibold">轻心</span>
				</a>
				<a
					href="/settings"
					class="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--qx-card)]"
					aria-label="设置"
				>
					<Icon name="user" />
				</a>
			</header>

			<main class="flex-1 px-5 pb-28 md:px-8 md:pt-8 md:pb-12">
				{@render children()}
			</main>
		</div>
	</div>

	{#if !hideTabs}
		<nav
			class="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--qx-line)] bg-[color-mix(in_srgb,var(--qx-bg)_86%,transparent)] px-2 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden"
		>
			<div class="mx-auto grid max-w-lg grid-cols-4">
				{#each TABS as tab (tab.href)}
					<a
						href={tab.href}
						class="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs {isTabActive(
							pathname,
							tab.href
						)
							? 'text-[var(--qx-primary)]'
							: 'text-[var(--qx-muted)]'}"
					>
						<Icon name={tab.icon} class="h-5 w-5" />
						<span class="text-[13px]">{tab.label}</span>
					</a>
				{/each}
			</div>
		</nav>
	{/if}
</div>

<script lang="ts">
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import { TOPBAR, isPlayView, isTopbarActive } from '../nav';
	import SpaceDust from '../shell/SpaceDust.svelte';
	import Icon from './Icon.svelte';
	import OfflineBanner from './OfflineBanner.svelte';
	import PrivacyGate from './PrivacyGate.svelte';
	import Toast from './Toast.svelte';

	let { children }: { children: Snippet } = $props();

	const pathname = $derived(page.url.pathname);
	const playView = $derived(isPlayView(pathname));
</script>

<div
	class="qx-shell relative min-h-dvh min-w-0 bg-[var(--qx-bg)] text-[var(--qx-text)]"
	data-qx-shell="board"
>
	{#if !playView}
		<div class="qx-nebula pointer-events-none" aria-hidden="true">
			<span class="qx-nebula-a"></span>
			<span class="qx-nebula-b"></span>
			<span class="qx-nebula-c"></span>
		</div>
		<SpaceDust {playView} />
	{/if}

	<OfflineBanner />
	<PrivacyGate />
	<Toast />

	<div class="relative z-10 flex min-h-dvh w-full min-w-0 flex-col">
		{#if !playView}
			<header
				data-qx-topbar="1"
				class="qx-glass sticky top-0 z-30 mx-3 mt-[max(0.4rem,env(safe-area-inset-top))] flex flex-wrap items-center gap-2 rounded-[1.35rem] px-3 py-2 md:mx-6 md:px-4"
			>
				<a href="/" class="flex min-h-11 min-w-11 items-center gap-2 px-1">
					<span
						class="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--qx-primary)] text-white"
					>
						<Icon name="logo" class="h-5 w-5" />
					</span>
					<span class="font-[Outfit] text-lg font-semibold tracking-wide">轻心</span>
				</a>
				<nav class="ml-auto flex flex-wrap items-center gap-1" aria-label="轻心">
					{#each TOPBAR as tab (tab.href)}
						<a
							href={tab.href}
							aria-current={isTopbarActive(pathname, tab.href) ? 'page' : undefined}
							class="flex min-h-11 items-center gap-1.5 rounded-2xl px-3 text-sm transition md:text-base {isTopbarActive(
								pathname,
								tab.href
							)
								? 'bg-[color-mix(in_oklab,var(--qx-primary)_18%,transparent)] text-[var(--qx-primary)]'
								: 'text-[var(--qx-muted)] hover:bg-[color-mix(in_oklab,var(--qx-card)_40%,transparent)]'}"
						>
							<Icon name={tab.icon} class="h-4 w-4" />
							{tab.label}
						</a>
					{/each}
				</nav>
			</header>
		{/if}

		<main
			class="min-w-0 flex-1 overflow-x-clip {playView
				? 'h-dvh overflow-hidden px-0 pb-0'
				: 'px-4 pt-5 pb-10 md:px-8 md:pt-6 md:pb-12'}"
		>
			{@render children()}
		</main>
	</div>
</div>

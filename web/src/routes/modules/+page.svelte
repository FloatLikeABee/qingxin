<script lang="ts">
	import Card from '#lib/components/Card.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { MODULES } from '#lib/modules';
</script>

<svelte:head>
	<title>轻心 · 模块</title>
</svelte:head>

<section class="mx-auto max-w-4xl">
	<h1 class="text-3xl font-semibold">模块中心</h1>
	<p class="mt-2 text-base text-[var(--qx-muted)]">十个生活工具，单页单任务，能用抽屉和弹窗解决的就不跳转。</p>

	<div class="mt-6 grid gap-3 sm:grid-cols-2">
		{#each MODULES as item (item.slug)}
			<a href="/modules/{item.slug}">
				<Card class="flex h-full items-start gap-4">
					<div
						class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
						style="background:{item.accent}"
					>
						<Icon name={item.icon} class="h-6 w-6" />
					</div>
					<div>
						<h2 class="text-lg font-semibold">{item.name}</h2>
						<p class="mt-1 text-base text-[var(--qx-muted)]">{item.summary}</p>
					</div>
				</Card>
			</a>
		{/each}
	</div>
</section>

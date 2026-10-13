<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Skeleton from '#lib/components/Skeleton.svelte';
	import Tag from '#lib/components/Tag.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let loading = $state(true);

	$effect(() => {
		void data.module.slug;
		loading = true;
		const timer = setTimeout(() => (loading = false), 420);
		return () => clearTimeout(timer);
	});
</script>

<svelte:head>
	<title>轻心 · {data.module.name}</title>
</svelte:head>

<section class="mx-auto max-w-2xl space-y-5">
	<a href="/modules" class="inline-flex min-h-11 items-center text-base text-[var(--qx-muted)]">← 返回模块中心</a>
	<div class="flex items-start gap-4">
		<div
			class="flex h-14 w-14 items-center justify-center rounded-2xl text-white"
			style="background:{data.module.accent}"
		>
			<Icon name={data.module.icon} class="h-7 w-7" />
		</div>
		<div>
			<Tag>即将接入</Tag>
			<h1 class="mt-2 text-3xl font-semibold">{data.module.name}</h1>
			<p class="mt-2 text-base text-[var(--qx-muted)]">{data.module.summary}</p>
		</div>
	</div>

	<Card>
		{#if loading}
			<Skeleton lines={4} />
		{:else}
			<EmptyState
				title="模块还在打磨"
				body="这里先占位。业务数据将通过 typed API 接入 T1 Forge，并写入 IndexedDB 以便离线阅读。"
				icon="spark"
			>
				{#snippet action()}
					<Button href="/kit">查看设计系统</Button>
				{/snippet}
			</EmptyState>
		{/if}
	</Card>
	<p class="text-sm text-[var(--qx-muted)]">内容定位为工具辅助与信息展示，不构成专业建议。</p>
</section>

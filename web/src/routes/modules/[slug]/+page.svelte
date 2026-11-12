<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Bento from '#lib/components/Bento.svelte';
	import BentoItem from '#lib/components/BentoItem.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Skeleton from '#lib/components/Skeleton.svelte';
	import Tag from '#lib/components/Tag.svelte';
	import { LINK_CLASS } from '#lib/ui/affordance';
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

<section class="mx-auto max-w-5xl min-w-0">
	<Bento>
		<BentoItem span="full">
			<a href="/modules" class={LINK_CLASS}>← 返回模块中心</a>
		</BentoItem>
		<BentoItem span="wide">
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
		</BentoItem>
		<BentoItem span="hero">
			<Card class="h-full">
				{#if loading}
					<Skeleton variant="page" />
				{:else}
					<EmptyState
						title="模块还在打磨"
						body="这里先占位。业务数据将通过 typed API 接入 T1 Forge，并写入 IndexedDB 以便离线阅读。"
						icon="spark"
					>
						{#snippet action()}
							{#if data.module.slug === 'elder'}
								<Button href="/elder">打开老人助手</Button>
							{:else if data.module.slug === 'pet'}
								<Button href="/pets">打开宠物</Button>
							{:else}
								<Button href="/modules">返回模块中心</Button>
							{/if}
						{/snippet}
					</EmptyState>
				{/if}
			</Card>
		</BentoItem>
		<BentoItem span="full">
			<p class="text-sm text-[var(--qx-muted)]">内容定位为工具辅助与信息展示，不构成专业建议。</p>
		</BentoItem>
	</Bento>
</section>

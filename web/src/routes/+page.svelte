<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Tag from '#lib/components/Tag.svelte';
	import { MODULES } from '#lib/modules';

	const hour = new Date().getHours();
	const greeting = hour < 12 ? '早安' : hour < 18 ? '下午好' : '夜安';
	const featured = MODULES.slice(0, 4);
</script>

<svelte:head>
	<title>轻心 · 首页</title>
</svelte:head>

<section class="mx-auto max-w-3xl space-y-6">
	<div class="pt-2">
		<Tag tone="primary">工具辅助 · 信息展示</Tag>
		<h1 class="mt-4 font-[Outfit] text-4xl leading-tight font-semibold tracking-tight md:text-5xl">
			{greeting}，<span class="text-[var(--qx-primary)]">轻一点</span>
		</h1>
		<p class="mt-3 max-w-xl text-base text-[var(--qx-muted)] md:text-lg">
			把情绪、账本、家人与灵感放在同一个安静的地方。轻心不提供医疗诊断、理财建议或法律咨询。
		</p>
	</div>

	<div class="grid gap-3 sm:grid-cols-2">
		{#each featured as item (item.slug)}
			<a href="/modules/{item.slug}" class="group">
				<Card class="h-full transition motion-safe:group-hover:-translate-y-0.5">
					<div
						class="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl text-white"
						style="background:{item.accent}"
					>
						<Icon name={item.icon} />
					</div>
					<h2 class="text-lg font-semibold">{item.name}</h2>
					<p class="mt-1 text-base text-[var(--qx-muted)]">{item.summary}</p>
				</Card>
			</a>
		{/each}
	</div>

	<Card>
		<EmptyState title="今天还没有新的记录" body="离线时也会为你保存草稿，网络恢复后会静默同步。" icon="cloud">
			{#snippet action()}
				<Button href="/modules">打开模块中心</Button>
			{/snippet}
		</EmptyState>
	</Card>
</section>

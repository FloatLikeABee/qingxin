<script lang="ts">
	import { onMount } from 'svelte';
	import { getApi } from '#lib/api/mock';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Tag from '#lib/components/Tag.svelte';
	import FunnelChart from '#lib/hustle/FunnelChart.svelte';
	import { funnelStages, type Application } from '#lib/hustle/funnel';
	import { statusTone } from '#lib/hustle/status';
	import { todayTodos } from '#lib/hustle/todos';
	import { INSPIRATION, PLATFORMS } from '#lib/create/catalog';
	import { MODULES } from '#lib/modules';

	const hour = new Date().getHours();
	const greeting = hour < 12 ? '早安' : hour < 18 ? '下午好' : '夜安';
	const featured = MODULES.slice(0, 4);
	let applications = $state<Application[]>([]);
	const stages = $derived(funnelStages(applications));
	const todos = $derived(todayTodos(applications, new Date().toISOString().slice(0, 10)));

	onMount(() => {
		void (async () => {
			const session = await getApi().getSession();
			if (!session) return;
			try {
				applications = await getApi().listApplications();
			} catch {
				applications = [];
			}
		})();
	});
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

	<Card>
		<div class="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
			<div>
				<h2 class="text-lg font-semibold">求职概览</h2>
				<p class="mt-1 text-sm text-[var(--qx-muted)]">今天的面试和待跟进投递。</p>
			</div>
			<Button href="/modules/hustle" variant="secondary" class="shrink-0 whitespace-nowrap"
				>打开求职副业</Button
			>
		</div>
		<div class="mt-4 flex flex-wrap gap-2">
			{#each stages as stage (stage.status)}
				<Tag tone={statusTone(stage.status)}>{stage.status} {stage.count}</Tag>
			{/each}
		</div>
		<FunnelChart {stages} />
		{#if todos.length === 0}
			<p class="text-sm text-[var(--qx-muted)]">今天还没有面试。把投递放进看板后会出现在这里。</p>
		{:else}
			<ul class="mt-2 space-y-2">
				{#each todos as item (item.id)}
					<li class="rounded-2xl bg-[var(--qx-surface)] px-4 py-3">
						<p class="font-medium">{item.title}</p>
						<p class="text-sm text-[var(--qx-muted)]">{item.detail}</p>
					</li>
				{/each}
			</ul>
		{/if}
	</Card>

	<Card>
		<div class="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
			<div>
				<h2 class="text-lg font-semibold">内容创作</h2>
				<p class="mt-1 text-sm text-[var(--qx-muted)]">选一个场景，把灵感写成可发出去的草稿。</p>
			</div>
			<Button href="/modules/create" variant="secondary" class="shrink-0 whitespace-nowrap"
				>打开内容创作</Button
			>
		</div>
		<div class="mt-4 grid gap-2 sm:grid-cols-2">
			{#each PLATFORMS as item (item)}
				<a
					href="/modules/create?platform={encodeURIComponent(item)}"
					class="min-h-11 rounded-2xl bg-[var(--qx-surface)] px-4 py-3"
				>
					<p class="font-medium">{item}</p>
					<p class="text-sm text-[var(--qx-muted)]">平台模板与预览</p>
				</a>
			{/each}
		</div>
		<ul class="mt-4 space-y-2">
			{#each INSPIRATION as item (item.id)}
				<li class="rounded-2xl bg-[var(--qx-surface)] px-4 py-3">
					<p class="font-medium">{item.topic}</p>
					<p class="text-sm text-[var(--qx-muted)]">{item.platform} · {item.hook}</p>
				</li>
			{/each}
		</ul>
	</Card>

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
		<EmptyState
			title="今天还没有新的记录"
			body="离线时也会为你保存草稿，网络恢复后会静默同步。"
			icon="cloud"
		>
			{#snippet action()}
				<Button href="/modules">打开模块中心</Button>
			{/snippet}
		</EmptyState>
	</Card>
</section>

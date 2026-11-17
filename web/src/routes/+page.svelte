<script lang="ts">
	import Bento from '#lib/components/Bento.svelte';
	import BentoItem from '#lib/components/BentoItem.svelte';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Tag from '#lib/components/Tag.svelte';
	import { MODULES } from '#lib/modules';
	import { SHAPES } from '#lib/jimutai/pieces';
	import { FLOORS } from '#lib/shangban/floors';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import { planBentoSpans } from '#lib/ui/bento';

	const hour = new Date().getHours();
	const greeting = hour < 12 ? '早安' : hour < 18 ? '下午好' : '夜安';
	const featured = MODULES.filter((item) =>
		['mood', 'finance', 'elder', 'pet'].includes(item.slug)
	);
	const featuredSpans = planBentoSpans(4);
	const pieceNames = Object.values(SHAPES).map((item) => item.name);
</script>

<svelte:head>
	<title>轻心 · 首页</title>
</svelte:head>

<section class="mx-auto max-w-5xl min-w-0">
	<Bento>
		<BentoItem span="full">
			<div class="pt-2">
				<Tag tone="primary">工具辅助 · 信息展示</Tag>
				<h1
					class="mt-4 font-[Outfit] text-4xl leading-tight font-semibold tracking-tight md:text-5xl"
				>
					{greeting}，<span class="text-[var(--qx-primary)]">轻一点</span>
				</h1>
				<p class="mt-3 max-w-xl text-base text-[var(--qx-muted)] md:text-lg">
					把情绪、账本、家人与灵感放在同一个安静的地方。轻心不提供医疗诊断、理财建议或法律咨询。
				</p>
			</div>
		</BentoItem>

		<BentoItem span="hero">
			<Card class="flex h-full flex-col">
				<div class="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
					<div>
						<h2 class="text-lg font-semibold">积木台</h2>
						<p class="mt-1 text-sm text-[var(--qx-muted)]">
							五块小积木，放到桌上拼在一起。没有输赢，拼完再给五块。
						</p>
					</div>
					<Button href="/modules/jimutai" variant="secondary" class="shrink-0 whitespace-nowrap"
						>去搭积木</Button
					>
				</div>
				<div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
					{#each pieceNames as name (name)}
						<a
							href="/modules/jimutai"
							class="flex min-h-11 items-center rounded-2xl bg-[var(--qx-surface)] px-4 py-3 text-[var(--qx-text)]"
						>
							{name}
						</a>
					{/each}
				</div>
			</Card>
		</BentoItem>

		<BentoItem span="hero">
			<Card class="flex h-full flex-col">
				<div class="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
					<div>
						<h2 class="text-lg font-semibold">上班</h2>
						<p class="mt-1 text-sm text-[var(--qx-muted)]">
							五层大厦，自己选岗位。走路、坐电梯、做手头的活。
						</p>
					</div>
					<Button href="/modules/shangban" variant="secondary" class="shrink-0 whitespace-nowrap"
						>去上班</Button
					>
				</div>
				<div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
					{#each FLOORS as floor (floor.id)}
						<a
							href="/modules/shangban"
							class="flex min-h-11 flex-col justify-center rounded-2xl bg-[var(--qx-surface)] px-4 py-3 text-[var(--qx-text)]"
						>
							<p class="font-medium">{floor.id}F {floor.name}</p>
							<p class="text-sm text-[var(--qx-muted)]">进楼层做事</p>
						</a>
					{/each}
				</div>
			</Card>
		</BentoItem>

		<BentoItem span="wide">
			<a href="/modules/secrets" class="group block h-full">
				<Card class="h-full transition motion-safe:group-hover:-translate-y-0.5">
					<div
						class="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl text-white"
						style="background:#C45C6A"
					>
						<Icon name="envelope" />
					</div>
					<h2 class="text-lg font-semibold">秘密</h2>
					<p class="mt-1 text-base text-[var(--qx-muted)]">
						把不想公开的话写成信。信箱回信，贴在木板上。
					</p>
					<span class="{LINK_CLASS} mt-3">打开信箱 <Icon name="chevron" class="h-4 w-4" /></span>
				</Card>
			</a>
		</BentoItem>

		{#each featured as item, index (item.slug)}
			<BentoItem span={featuredSpans[index] ?? 'unit'}>
				<a href="/modules/{item.slug}" class="group block h-full">
					<Card class="h-full transition motion-safe:group-hover:-translate-y-0.5">
						<div
							class="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl text-white"
							style="background:{item.accent}"
						>
							<Icon name={item.icon} />
						</div>
						<h2 class="text-lg font-semibold">{item.name}</h2>
						<p class="mt-1 text-base text-[var(--qx-muted)]">{item.summary}</p>
						<span class="{LINK_CLASS} mt-3">打开 <Icon name="chevron" class="h-4 w-4" /></span>
					</Card>
				</a>
			</BentoItem>
		{/each}

		<BentoItem span="full">
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
		</BentoItem>
	</Bento>
</section>

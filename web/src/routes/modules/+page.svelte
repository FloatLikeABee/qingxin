<script lang="ts">
	import Bento from '#lib/components/Bento.svelte';
	import BentoItem from '#lib/components/BentoItem.svelte';
	import Card from '#lib/components/Card.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { MODULES } from '#lib/modules';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import { planBentoSpans } from '#lib/ui/bento';

	const spans = planBentoSpans(MODULES.length);
</script>

<svelte:head>
	<title>轻心 · 模块</title>
</svelte:head>

<section class="mx-auto min-w-0 max-w-5xl">
	<Bento>
		<BentoItem span="full">
			<div>
				<h1 class="font-[Outfit] text-3xl font-semibold tracking-tight">模块中心</h1>
				<p class="mt-2 text-[var(--qx-muted)]">
					十个生活工具，单页单任务，能用抽屉和弹窗解决的就不跳转。
				</p>
			</div>
		</BentoItem>
		{#each MODULES as item, index (item.slug)}
			<BentoItem span={spans[index] ?? 'unit'}>
				<a href="/modules/{item.slug}" class="group block h-full">
					<Card class="h-full transition motion-safe:group-hover:-translate-y-0.5">
						<div class="flex items-start justify-between gap-3">
							<div
								class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"
								style="background:{item.accent}"
							>
								<Icon name={item.icon} />
							</div>
							<Icon name="chevron" class="mt-2 h-5 w-5 shrink-0 text-[var(--qx-muted)]" />
						</div>
						<h2 class="mt-5 text-lg font-semibold">{item.name}</h2>
						<p class="mt-1 text-base text-[var(--qx-muted)]">{item.summary}</p>
						<span class="{LINK_CLASS} mt-3">打开</span>
					</Card>
				</a>
			</BentoItem>
		{/each}
	</Bento>
</section>

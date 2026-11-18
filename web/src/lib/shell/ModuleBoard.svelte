<script lang="ts">
	import Bento from '#lib/components/Bento.svelte';
	import BentoItem from '#lib/components/BentoItem.svelte';
	import Card from '#lib/components/Card.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { MODULES } from '#lib/modules';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import { planBentoSpans } from '#lib/ui/bento';

	let { heading = true }: { heading?: boolean } = $props();
	const spans = planBentoSpans(MODULES.length);
</script>

<Bento>
	{#if heading}
		<BentoItem span="full">
			<div>
				<h2 class="font-[Outfit] text-2xl font-semibold tracking-tight">模块中心</h2>
				<p class="mt-2 text-[var(--qx-muted)]">从这块玻璃板上打开要去的地方。没有侧栏。</p>
			</div>
		</BentoItem>
	{/if}
	{#each MODULES as item, index (item.slug)}
		<BentoItem span={spans[index] ?? 'unit'}>
			<a href="/modules/{item.slug}" class="group block h-full" data-board-tile={item.slug}>
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

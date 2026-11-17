<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import { retiredBySlug, type RetiredModule } from './catalog';

	let { slug }: { slug: RetiredModule['slug'] } = $props();
	const item = $derived(retiredBySlug(slug));
</script>

<svelte:head>
	<title>轻心 · {item?.name ?? '模块'}</title>
</svelte:head>

<section class="mx-auto max-w-3xl min-w-0 px-1 py-6" data-retired={slug}>
	<a href="/modules" class={LINK_CLASS}>← 返回模块中心</a>
	<Card class="mt-4">
		<EmptyState
			title="{item?.name ?? '这个模块'}已经从轻心主入口撤下"
			body={item?.blurb ?? ''}
			icon="info"
		>
			{#snippet action()}
				<Button href="/modules">返回模块中心</Button>
			{/snippet}
		</EmptyState>
	</Card>
</section>

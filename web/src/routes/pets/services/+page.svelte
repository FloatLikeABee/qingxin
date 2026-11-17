<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import DisclaimerBanner from '#lib/pets/DisclaimerBanner.svelte';
</script>

<svelte:head>
	<title>轻心 · 附近宠物服务</title>
</svelte:head>

<h1 class="text-3xl font-semibold">附近服务</h1>
<DisclaimerBanner />

<Card>
	<EmptyState
		title="附近服务名单暂不开放"
		body="本地生活入口已经从轻心撤下。这里不再跳转过去。宠物模块里的记录还在。"
		icon="spark"
	>
		{#snippet action()}
			<Button href="/pets">返回宠物</Button>
		{/snippet}
	</EmptyState>
</Card>

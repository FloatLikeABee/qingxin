<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import DisclaimerBanner from '#lib/pets/DisclaimerBanner.svelte';
	import { LOCAL_LIFE_HREF } from '#lib/pets/disclaimer';
</script>

<svelte:head>
	<title>轻心 · 附近宠物服务</title>
</svelte:head>

<h1 class="text-3xl font-semibold">附近服务</h1>
<DisclaimerBanner />

<Card>
	<EmptyState
		title="附近服务即将接入"
		body="24 小时宠物医院、寄养和洗护会放在本地生活地图里。这里先跳转到那个入口，不重复做一份名单。"
		icon="spark"
	>
		{#snippet action()}
			<Button href={LOCAL_LIFE_HREF}>打开本地生活</Button>
		{/snippet}
	</EmptyState>
</Card>

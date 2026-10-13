<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import Icon from '#lib/components/Icon.svelte';
</script>

<svelte:head>
	<title>轻心 · 离线</title>
</svelte:head>

<section class="mx-auto flex min-h-[60vh] max-w-md items-center">
	<Card class="w-full text-center">
		<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
			<Icon name="wifi" class="h-6 w-6" />
		</div>
		<h1 class="text-2xl font-semibold">你正在离线</h1>
		<p class="mt-2 text-base text-[var(--qx-muted)]">
			应用外壳仍可使用。已缓存的首页与模块会继续显示，网络恢复后会静默同步。
		</p>
		<Button class="mt-6 w-full" href="/">回到首页</Button>
	</Card>
</section>

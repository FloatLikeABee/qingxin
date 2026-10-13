<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import Input from '#lib/components/Input.svelte';
	import { FRAUD_SCRIPTS } from '#lib/elder/demo';

	let query = $state('');
	let phone = $state('');
	let check = $state<string | null>(null);

	const items = $derived(
		FRAUD_SCRIPTS.filter((item) => {
			const q = query.trim();
			if (!q) return true;
			return item.title.includes(q) || item.body.includes(q);
		})
	);

	function runCheck() {
		const digits = phone.replace(/\D/g, '');
		if (digits.length < 5) {
			check = '请输入完整号码后再查。';
			return;
		}
		check = '本地演示未发现标记。若对方要你转账、报验证码或下载远控软件，请挂断并拨打 96110。';
	}
</script>

<svelte:head>
	<title>轻心 · 防诈卫士</title>
</svelte:head>

<section class="mx-auto max-w-2xl space-y-5">
	<a href="/elder" class="inline-flex min-h-14 items-center text-lg">← 返回首页</a>
	<h1 class="text-3xl font-semibold">防诈卫士</h1>
	<p class="text-lg text-[var(--qx-muted)]">
		话术来自公开的国家反诈中心宣传，只做信息展示，不是法律意见。
	</p>
	<Input bind:value={query} label="搜索话术" placeholder="例如：公检法、刷单" />
	<div class="space-y-3">
		{#each items as item (item.id)}
			<Card class="space-y-2">
				<h2 class="text-xl font-semibold">{item.title}</h2>
				<p class="text-lg leading-8">{item.body}</p>
				<p class="text-sm text-[var(--qx-muted)]">
					来源：<a class="underline" href={item.sourceUrl} target="_blank" rel="noreferrer"
						>{item.sourceName}</a
					>
				</p>
			</Card>
		{/each}
	</div>
	<Card class="space-y-3">
		<h2 class="text-xl font-semibold">查一查号码</h2>
		<Input bind:value={phone} label="电话号码" inputmode="tel" placeholder="+86138…" />
		<Button class="min-h-14 w-full text-lg" onclick={runCheck}>查询</Button>
		{#if check}
			<p class="text-lg">{check}</p>
		{/if}
	</Card>
</section>

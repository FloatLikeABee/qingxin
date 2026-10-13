<script lang="ts">
	import Card from '#lib/components/Card.svelte';
</script>

<svelte:head>
	<title>轻心 · 隐私政策</title>
</svelte:head>

<article class="prose prose-slate dark:prose-invert mx-auto max-w-2xl">
	<h1>隐私政策与免责声明</h1>
	<Card>
		<p>轻心遵循最小必要原则：默认只在你的设备上保存主题、同意状态与离线缓存。</p>
		<p>我们不会在未征得同意时采集身份证或手机号。敏感字段的加密存储将在后端落地后启用。</p>
		<p>
			<strong>资质红线：</strong>轻心严禁提供医疗诊断、金融理财建议或法律咨询。所有模块均为工具辅助与信息展示。
		</p>
		<p>你可以在设置中一键导出或删除本地数据。内容安全审核将接入云厂商 API，当前版本仅保留接口位置。</p>
	</Card>
</article>

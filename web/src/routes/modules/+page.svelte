<script lang="ts">
	import Bento from '#lib/components/Bento.svelte';
	import BentoItem from '#lib/components/BentoItem.svelte';
	import ModuleBoard from '#lib/shell/ModuleBoard.svelte';
</script>

<svelte:head>
	<title>轻心 · 模块</title>
</svelte:head>

<section class="mx-auto max-w-5xl min-w-0">
	<Bento>
		<BentoItem span="full">
			<div>
				<h1 class="font-[Outfit] text-3xl font-semibold tracking-tight">模块中心</h1>
				<p class="mt-2 text-[var(--qx-muted)]">
					上班是主产品场景。积木台是另一张可以慢慢搭的桌子。秘密信箱单独收信。游戏可以进店里过一个班次。旧的内容草稿还在原地址。
				</p>
			</div>
		</BentoItem>
	</Bento>
	<div class="mt-4">
		<ModuleBoard heading={false} />
	</div>
</section>

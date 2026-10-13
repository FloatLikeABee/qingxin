<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import Drawer from '#lib/components/Drawer.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Input from '#lib/components/Input.svelte';
	import ListItem from '#lib/components/ListItem.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import Skeleton from '#lib/components/Skeleton.svelte';
	import Switch from '#lib/components/Switch.svelte';
	import Tabs from '#lib/components/Tabs.svelte';
	import Tag from '#lib/components/Tag.svelte';
	import Textarea from '#lib/components/Textarea.svelte';
	import { pushToast } from '#lib/toast';

	let tab = $state(0);
	let notify = $state(true);
	let modalOpen = $state(false);
	let drawerOpen = $state(false);
	let name = $state('轻心');
	let note = $state('把日子过轻一点');
</script>

<svelte:head>
	<title>轻心 · 设计系统</title>
</svelte:head>

<section class="mx-auto max-w-3xl space-y-8">
	<div>
		<h1 class="text-3xl font-semibold">设计系统</h1>
		<p class="mt-2 text-base text-[var(--qx-muted)]">
			按钮高度 ≥ 44px，关键文字 ≥ 16px。优先抽屉、弹窗与 Tab，而不是把用户赶去下一页。
		</p>
	</div>

	<section class="space-y-3">
		<h2 class="text-xl font-semibold">Button</h2>
		<div class="flex flex-wrap gap-3">
			<Button>主要操作</Button>
			<Button variant="secondary">次要操作</Button>
			<Button variant="ghost">轻量</Button>
			<Button variant="danger">危险</Button>
		</div>
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-semibold">Card / Tag / Icon</h2>
		<Card class="flex items-center justify-between">
			<div class="flex items-center gap-3">
				<span class="text-[var(--qx-primary)]"><Icon name="logo" class="h-6 w-6" /></span>
				<div>
					<p class="text-base font-medium">轻心卡片</p>
					<p class="text-base text-[var(--qx-muted)]">页面背景、分割线与图标填充都会跟随主题。</p>
				</div>
			</div>
			<Tag tone="primary">Chip</Tag>
		</Card>
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-semibold">Input / Textarea</h2>
		<Input label="称呼" bind:value={name} />
		<Textarea label="一句话" bind:value={note} />
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-semibold">Tabs</h2>
		<Tabs tabs={['今日', '本周', '归档']} bind:value={tab} />
		<p class="text-base text-[var(--qx-muted)]">当前：{['今日', '本周', '归档'][tab]}</p>
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-semibold">Switch</h2>
		<Card>
			<Switch bind:checked={notify} label="微提醒" description="尊重系统的减少动态效果。" />
		</Card>
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-semibold">Toast / Drawer / Modal</h2>
		<div class="flex flex-wrap gap-3">
			<Button onclick={() => pushToast({ title: '已保存到本地', tone: 'success' })}>Toast</Button>
			<Button variant="secondary" onclick={() => (drawerOpen = true)}>底部抽屉</Button>
			<Button variant="secondary" onclick={() => (modalOpen = true)}>模态弹窗</Button>
		</div>
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-semibold">Skeleton / EmptyState / ListItem</h2>
		<Card><Skeleton /></Card>
		<Card>
			<EmptyState title="空状态" body="没有内容时保持呼吸感，而不是空白墙。" />
		</Card>
		<Card padded={false}>
			<ListItem title="情绪日记+冥想" subtitle="写下一句就好" icon="cloud" href="/modules/mood" />
		</Card>
	</section>
</section>

<Drawer bind:open={drawerOpen} title="底部抽屉">
	<p class="text-base text-[var(--qx-muted)]">核心操作放在屏幕下半部，拇指能够到。</p>
	<Button class="mt-5 w-full" onclick={() => (drawerOpen = false)}>完成</Button>
</Drawer>

<Modal bind:open={modalOpen} title="模态说明">
	<p>减少跳转，把确认留在当前心流里。点击遮罩或按 Esc 即可关闭。</p>
	{#snippet footer()}
		<Button onclick={() => (modalOpen = false)}>知道了</Button>
	{/snippet}
</Modal>

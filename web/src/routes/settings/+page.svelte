<script lang="ts">
	import { browser } from '$app/env';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import Drawer from '#lib/components/Drawer.svelte';
	import ListItem from '#lib/components/ListItem.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import { getApi } from '#lib/api/mock';
	import { persistMode, readStoredMode, syncDocumentTheme } from '#lib/theme/runtime';
	import type { ThemeMode } from '#lib/theme/resolve';
	import { optimistic } from '#lib/optimistic';
	import { pushToast } from '#lib/toast';

	const modes: { id: ThemeMode; label: string; hint: string }[] = [
		{ id: 'light', label: '浅色', hint: '柔和清晨' },
		{ id: 'dark', label: '深色', hint: '低饱和夜读' },
		{ id: 'system', label: '跟随系统', hint: '匹配设备外观' },
		{ id: 'night-only', label: '仅夜间开启', hint: '19:00–07:00 自动深色' }
	];

	let mode = $state<ThemeMode>('system');
	let sessionName = $state<string | null>(null);
	let exportOpen = $state(false);
	let deleteOpen = $state(false);
	let pending = $state(false);

	$effect(() => {
		if (!browser) return;
		mode = readStoredMode();
		void getApi()
			.getSession()
			.then((session) => {
				sessionName = session?.displayName ?? null;
			});
	});

	function choose(next: ThemeMode) {
		const previous = mode;
		void optimistic(
			() => {
				mode = next;
				persistMode(next);
				syncDocumentTheme(next);
			},
			() => {
				mode = previous;
				persistMode(previous);
				syncDocumentTheme(previous);
			},
			async () => next
		);
	}

	async function exportData() {
		pending = true;
		try {
			const payload = await getApi().exportUserData();
			const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = 'qingxin-export.json';
			link.click();
			URL.revokeObjectURL(url);
			pushToast({ title: '数据已导出', tone: 'success' });
			exportOpen = false;
		} catch {
			pushToast({ title: '请先登录再导出', tone: 'danger' });
		} finally {
			pending = false;
		}
	}

	async function deleteAccount() {
		pending = true;
		try {
			await getApi().deleteAccount();
			sessionName = null;
			pushToast({ title: '账号已从本地清除', tone: 'success' });
			deleteOpen = false;
		} finally {
			pending = false;
		}
	}
</script>

<svelte:head>
	<title>轻心 · 设置</title>
</svelte:head>

<section class="mx-auto max-w-2xl space-y-5">
	<div>
		<h1 class="text-3xl font-semibold">我的</h1>
		<p class="mt-2 text-base text-[var(--qx-muted)]">
			{sessionName ? `已登录：${sessionName}` : '尚未登录 · 本地演示环境'}
		</p>
	</div>

	<Card>
		<h2 class="mb-3 text-lg font-semibold">外观</h2>
		<div class="grid grid-cols-2 gap-2">
			{#each modes as item (item.id)}
				<button
					type="button"
					class="min-h-16 rounded-2xl px-3 py-3 text-left ring-1 transition {mode === item.id
						? 'bg-[color-mix(in_srgb,var(--qx-primary)_14%,transparent)] ring-[var(--qx-primary)]'
						: 'bg-[var(--qx-surface)] ring-transparent'}"
					onclick={() => choose(item.id)}
				>
					<span class="block text-base font-medium">{item.label}</span>
					<span class="block text-sm text-[var(--qx-muted)]">{item.hint}</span>
				</button>
			{/each}
		</div>
	</Card>

	<Card padded={false} class="divide-y divide-[var(--qx-line)] py-1">
		<ListItem href="/login" title="登录 / 注册" subtitle="把设置同步到账号（即将接入 T1）" icon="lock" />
		<ListItem title="导出我的数据" subtitle="下载本地 JSON 副本" icon="download" onclick={() => (exportOpen = true)} />
		<ListItem title="注销并删除数据" subtitle="清除本机模拟账号" icon="trash" onclick={() => (deleteOpen = true)} />
		<ListItem href="/privacy" title="隐私与免责声明" subtitle="最小必要 · 非专业建议" icon="info" />
	</Card>

	<p class="text-sm text-[var(--qx-muted)]">添加到主屏幕：在浏览器菜单中选择「添加到主屏幕」，即可离线打开轻心。</p>
</section>

<Drawer bind:open={exportOpen} title="导出数据">
	<p class="text-base text-[var(--qx-muted)]">将导出本地模拟会话与模块清单。真实云端数据会在 T1 接入后补齐。</p>
	<Button class="mt-5 w-full" disabled={pending} onclick={exportData}>下载 JSON</Button>
</Drawer>

<Modal bind:open={deleteOpen} title="确认删除？">
	<p>此操作会清除本地模拟会话，不可恢复。这是设置页的注销入口，尚未连接真实后端。</p>
	{#snippet footer()}
		<Button variant="danger" disabled={pending} onclick={deleteAccount}>确认删除</Button>
		<Button variant="secondary" onclick={() => (deleteOpen = false)}>取消</Button>
	{/snippet}
</Modal>

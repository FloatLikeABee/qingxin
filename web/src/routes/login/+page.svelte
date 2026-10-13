<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import Input from '#lib/components/Input.svelte';
	import { ApiError, getApi } from '#lib/api/mock';
	import { pushToast } from '#lib/toast';

	let email = $state('demo@qingxin.app');
	let password = $state('qingxin');
	let pending = $state(false);
	let error = $state('');

	async function submit(event: Event) {
		event.preventDefault();
		pending = true;
		error = '';
		try {
			await getApi().login(email, password);
			pushToast({ title: '欢迎回来', tone: 'success' });
			await goto('/settings');
		} catch (err) {
			error = err instanceof ApiError ? err.message : '登录失败';
		} finally {
			pending = false;
		}
	}
</script>

<svelte:head>
	<title>轻心 · 登录</title>
</svelte:head>

<section class="mx-auto max-w-md pt-6">
	<h1 class="text-3xl font-semibold">登录</h1>
	<p class="mt-2 text-base text-[var(--qx-muted)]">演示账号 demo@qingxin.app / qingxin</p>
	<Card class="mt-6">
		<form class="space-y-4" onsubmit={submit}>
			<Input label="邮箱" type="email" autocomplete="username" bind:value={email} />
			<Input label="密码" type="password" autocomplete="current-password" bind:value={password} />
			{#if error}
				<p class="text-base text-rose-500">{error}</p>
			{/if}
			<Button type="submit" class="w-full" disabled={pending}>{pending ? '登录中…' : '登录'}</Button>
		</form>
	</Card>
	<p class="mt-4 text-base">
		还没有账号？
		<a class="text-[var(--qx-primary)]" href="/register">创建账号</a>
	</p>
</section>

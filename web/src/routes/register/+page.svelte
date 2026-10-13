<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import Input from '#lib/components/Input.svelte';
	import { ApiError, getApi } from '#lib/api/client';
	import { pushToast } from '#lib/toast';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let pending = $state(false);
	let error = $state('');

	async function submit(event: Event) {
		event.preventDefault();
		pending = true;
		error = '';
		try {
			await getApi().register(name, email, password);
			pushToast({ title: '账号已创建', tone: 'success' });
			await goto('/settings');
		} catch (err) {
			error = err instanceof ApiError ? err.message : '注册失败';
		} finally {
			pending = false;
		}
	}
</script>

<svelte:head>
	<title>轻心 · 注册</title>
</svelte:head>

<section class="mx-auto max-w-md pt-6">
	<h1 class="text-3xl font-semibold">创建账号</h1>
	<p class="mt-2 text-base text-[var(--qx-muted)]">邮箱注册，密码至少 8 位。</p>
	<Card class="mt-6">
		<form class="space-y-4" onsubmit={submit}>
			<Input label="称呼" autocomplete="name" bind:value={name} />
			<Input label="邮箱" type="email" autocomplete="email" bind:value={email} />
			<Input
				label="密码"
				type="password"
				autocomplete="new-password"
				bind:value={password}
				hint="至少 8 位"
			/>
			{#if error}
				<p class="text-base text-rose-500">{error}</p>
			{/if}
			<Button type="submit" class="w-full" disabled={pending}>{pending ? '提交中…' : '注册'}</Button
			>
		</form>
	</Card>
	<p class="mt-4 text-base">
		已有账号？
		<a class="text-[var(--qx-primary)]" href="/login">去登录</a>
	</p>
</section>

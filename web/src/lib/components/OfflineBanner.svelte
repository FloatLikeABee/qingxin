<script lang="ts">
	import { browser } from '$app/env';
	import { drainSync, openQingxinDb } from '../offline/cache';
	import { getApi } from '../api/mock';
	import { pushToast } from '../toast';
	import Icon from './Icon.svelte';

	let online = $state(true);

	$effect(() => {
		if (!browser) return;
		online = navigator.onLine;
		const update = () => {
			const next = navigator.onLine;
			const wasOffline = !online;
			online = next;
			if (next && wasOffline) {
				void silentSync();
			}
		};
		window.addEventListener('online', update);
		window.addEventListener('offline', update);
		return () => {
			window.removeEventListener('online', update);
			window.removeEventListener('offline', update);
		};
	});

	async function silentSync() {
		try {
			const db = await openQingxinDb();
			await drainSync(db, async (op) => {
				if (op.type === 'export') {
					await getApi().exportUserData();
				}
			});
			db.close();
		} catch {
			pushToast({ title: '同步稍后重试', tone: 'info' });
		}
	}
</script>

{#if !online}
	<div
		class="flex min-h-11 items-center justify-center gap-2 bg-amber-500 px-4 text-base font-medium text-amber-950"
		role="status"
	>
		<Icon name="wifi" class="h-4 w-4" />
		当前离线，正在展示本地缓存
	</div>
{/if}

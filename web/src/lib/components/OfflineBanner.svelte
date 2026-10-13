<script lang="ts">
	import { browser } from '$app/env';
	import { drainSync, openQingxinDb } from '../offline/cache';
	import { ApiError, getApi } from '../api/client';
	import { pushToast } from '../toast';
	import type { ToolId } from '../tools/catalog';
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
				try {
					if (op.type === 'export') {
						await getApi().exportUserData();
					}
					if (op.type === 'mood_log_create') {
						const payload = op.payload as {
							id?: string;
							emoji: string;
							tags: string[];
							note?: string;
						};
						await getApi().createMoodLog(payload);
					}
					if (op.type === 'meditation_session_create') {
						const payload = op.payload as {
							id?: string;
							kind: 'breathe' | 'noise' | 'story' | 'timer';
							durationSec: number;
							payload?: Record<string, unknown>;
						};
						await getApi().createMeditationSession(payload);
					}
					if (op.type === 'hustle_application_create') {
						const payload = op.payload as {
							id?: string;
							company: string;
							position: string;
							status?: '投递' | '面试' | 'Offer';
						};
						await getApi().createApplication(payload);
					}
					if (op.type === 'local_review_create') {
						const payload = op.payload as {
							id?: string;
							serviceId: string;
							content: string;
							rating?: number;
							images?: string[];
						};
						await getApi().createLocalReview(payload.serviceId, payload);
					}
					if (op.type === 'local_service_create') {
						const payload = op.payload as {
							id?: string;
							name: string;
							category: '维修' | '宠物' | '配送' | '适老';
							address: string;
							latitude: number;
							longitude: number;
							hours?: string;
							phone?: string;
							tags?: Array<'有坡道' | '大字菜单' | '耐心服务'>;
						};
						await getApi().createLocalService(payload);
					}
					if (op.type === 'local_correction_create') {
						const payload = op.payload as {
							id?: string;
							serviceId: string;
							kind: '已搬迁' | '电话空号';
						};
						await getApi().createLocalCorrection(payload.serviceId, payload);
					}
					if (op.type === 'create_work_create') {
						const payload = op.payload as {
							id?: string;
							platform: '小红书' | '公众号' | '抖音' | '周报';
							title?: string;
							promptParams?: Record<string, unknown>;
							generatedContent: string;
							finalContent?: string;
						};
						await getApi().createCreation(payload);
					}
					if (op.type === 'tools_favourite') {
						const payload = op.payload as { toolId: ToolId; favourite: boolean };
						await getApi().setToolFavourite(payload.toolId, payload.favourite);
					}
					if (op.type === 'finance_transaction_create') {
						const payload = op.payload as {
							amountFen: number;
							type: 'income' | 'expense';
							categoryId: string;
							note?: string | null;
							occurredOn: string;
							clientId: string;
						};
						await getApi().createFinanceTransaction(payload);
					}
					if (op.type === 'wellness_water_create') {
						const payload = op.payload as { ml: number; loggedOn: string };
						await getApi().addWellnessWater(payload.ml, payload.loggedOn);
					}
					if (op.type === 'elder_reminder_ack') {
						const payload = op.payload as {
							id: string;
							occurrenceAt: string;
							elderId?: string;
						};
						await getApi().ackElderReminder(payload.id, payload.occurrenceAt, payload.elderId);
					}
				} catch (error) {
					if (error instanceof ApiError && error.code === 'conflict') return;
					throw error;
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

import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError, MockQingxinApi, resetApi } from '../api/client';
import { listPendingSync, openQingxinDb } from '../offline/cache';
import { cacheLogs, loadCachedLogs, saveCheckIn, saveMeditationSession } from './store';
import type { MoodLog } from './trends';

afterEach(async () => {
	resetApi();
	await new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase('qingxin');
		request.onsuccess = () => resolve();
		request.onerror = () => resolve();
		request.onblocked = () => resolve();
	});
});

describe('mood store', () => {
	it('reads cached logs back from IndexedDB', async () => {
		const logs: MoodLog[] = [
			{
				id: 'log-1',
				emoji: '😔',
				score: 2,
				tags: ['睡眠'],
				note: '夜里醒了两次',
				createdAt: '2026-10-13T01:00:00Z'
			}
		];
		await cacheLogs(logs);
		await expect(loadCachedLogs()).resolves.toEqual(logs);
	});

	it('enqueues an offline check-in as mood_log_create', async () => {
		class OfflineApi extends MockQingxinApi {
			override async createMoodLog(): Promise<MoodLog> {
				throw new ApiError('unavailable', '网络不可用');
			}
		}
		const api = new OfflineApi();
		await api.login('demo@qingxin.app', 'qingxin');
		resetApi(api);
		Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
		await saveCheckIn({ emoji: '😔', tags: ['睡眠'], note: '夜里醒了两次' }, () => {}, () => {});
		const db = await openQingxinDb();
		try {
			const pending = await listPendingSync(db);
			expect(pending.some((op) => op.type === 'mood_log_create')).toBe(true);
		} finally {
			db.close();
		}
	});

	it('enqueues an offline meditation session', async () => {
		class OfflineApi extends MockQingxinApi {
			override async createMeditationSession(): Promise<never> {
				throw new ApiError('unavailable', '网络不可用');
			}
		}
		const api = new OfflineApi();
		await api.login('demo@qingxin.app', 'qingxin');
		resetApi(api);
		Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
		Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
		await saveMeditationSession({ kind: 'timer', durationSec: 180 });
		const db = await openQingxinDb();
		try {
			const pending = await listPendingSync(db);
			expect(pending.some((op) => op.type === 'meditation_session_create')).toBe(true);
		} finally {
			db.close();
		}
	});
});

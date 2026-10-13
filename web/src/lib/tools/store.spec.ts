import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError, MockQingxinApi, resetApi } from '../api/mock';
import type { AiTask } from '../api/types';
import { listPendingSync, openQingxinDb } from '../offline/cache';
import type { ToolId } from './catalog';
import { cacheTasks, loadCachedTasks, toggleFavourite } from './store';

afterEach(async () => {
	resetApi();
	await new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase('qingxin');
		request.onsuccess = () => resolve();
		request.onerror = () => resolve();
		request.onblocked = () => resolve();
	});
});

describe('tools store', () => {
	it('reads cached tasks from IndexedDB', async () => {
		const tasks: AiTask[] = [
			{
				id: 't-1',
				toolId: 'summary',
				inputKind: 'text',
				inputText: '买菜',
				inputMeta: {},
				outputText: '摘要',
				outputJson: {},
				source: 'mock',
				disclaimer: '不构成',
				createdAt: '2026-10-13T01:00:00Z'
			}
		];
		await cacheTasks(tasks);
		await expect(loadCachedTasks()).resolves.toEqual(tasks);
	});

	it('queues favourite toggles while offline', async () => {
		class OfflineApi extends MockQingxinApi {
			override async setToolFavourite(
				_toolId: ToolId,
				_favourite: boolean
			): Promise<{ toolId: ToolId; favourite: boolean }> {
				throw new ApiError('unavailable', 'offline');
			}
		}
		const api = new OfflineApi();
		await api.login('demo@qingxin.app', 'qingxin');
		resetApi(api);
		const original = navigator.onLine;
		Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
		await toggleFavourite('summary', true);
		Object.defineProperty(navigator, 'onLine', { configurable: true, value: original });
		const db = await openQingxinDb();
		try {
			const pending = await listPendingSync(db);
			expect(pending.some((item) => item.type === 'tools_favourite')).toBe(true);
		} finally {
			db.close();
		}
	});
});

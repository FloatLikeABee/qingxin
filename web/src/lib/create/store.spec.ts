import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError, MockQingxinApi, resetApi } from '../api/mock';
import { listPendingSync, openQingxinDb } from '../offline/cache';
import {
	cacheCreations,
	cacheSnippets,
	loadCachedCreations,
	loadCachedSnippets,
	saveCreation
} from './store';
import type { Creation, CreateSnippet } from '../api/types';

afterEach(async () => {
	resetApi();
	await new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase('qingxin');
		request.onsuccess = () => resolve();
		request.onerror = () => resolve();
		request.onblocked = () => resolve();
	});
});

describe('create store', () => {
	it('reads cached creations and snippets from IndexedDB', async () => {
		const works: Creation[] = [
			{
				id: 'c-1',
				platform: '小红书',
				generatedContent: '第一稿',
				finalContent: '第一稿',
				versions: [],
				createdAt: '2026-10-13T01:00:00Z',
				updatedAt: '2026-10-13T01:00:00Z'
			}
		];
		const snips: CreateSnippet[] = [
			{
				id: 's-1',
				content: '把结论写在第一句。',
				kind: '金句',
				tags: ['开头'],
				usageCount: 0,
				createdAt: '2026-10-13T01:00:00Z',
				updatedAt: '2026-10-13T01:00:00Z'
			}
		];
		await cacheCreations(works);
		await cacheSnippets(snips);
		await expect(loadCachedCreations()).resolves.toEqual(works);
		await expect(loadCachedSnippets()).resolves.toEqual(snips);
	});

	it('patches an existing work and appends a version instead of duplicating', async () => {
		const api = new MockQingxinApi();
		await api.login('demo@qingxin.app', 'qingxin');
		resetApi(api);
		const created = await saveCreation(
			{
				platform: '小红书',
				title: '阳台种菜',
				promptParams: { topic: '阳台种菜' },
				generatedContent: '第一稿'
			},
			() => {},
			() => {}
		);
		const saved = await saveCreation(
			{
				id: created.id,
				platform: '小红书',
				title: '阳台种菜',
				promptParams: { topic: '阳台种菜' },
				generatedContent: '第一稿',
				finalContent: '定稿'
			},
			() => {},
			() => {}
		);
		expect(saved.id).toBe(created.id);
		expect(saved.finalContent).toBe('定稿');
		expect(saved.versions.length).toBeGreaterThan(created.versions.length);
		const listed = await api.listCreations();
		expect(listed.filter((item) => item.id === created.id)).toHaveLength(1);
		const same = await saveCreation(
			{
				id: created.id,
				platform: '小红书',
				title: '阳台种菜',
				generatedContent: '第一稿',
				finalContent: '定稿'
			},
			() => {},
			() => {}
		);
		expect(same.versions).toHaveLength(saved.versions.length);
	});

	it('enqueues an offline create as create_work_create', async () => {
		class OfflineApi extends MockQingxinApi {
			override async createCreation(): Promise<Creation> {
				throw new ApiError('unavailable', '网络不可用');
			}
		}
		const api = new OfflineApi();
		await api.login('demo@qingxin.app', 'qingxin');
		resetApi(api);
		Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
		await saveCreation(
			{
				platform: '小红书',
				promptParams: { topic: '阳台种菜' },
				generatedContent: '第一稿'
			},
			() => {},
			() => {}
		);
		const db = await openQingxinDb();
		try {
			const pending = await listPendingSync(db);
			expect(pending.some((op) => op.type === 'create_work_create')).toBe(true);
		} finally {
			db.close();
		}
	});
});

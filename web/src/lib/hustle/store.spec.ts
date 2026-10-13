import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError, MockQingxinApi, resetApi } from '../api/mock';
import { listPendingSync, openQingxinDb } from '../offline/cache';
import {
	cacheApplications,
	cacheResumes,
	cacheSideHustles,
	loadCachedApplications,
	loadCachedResumes,
	loadCachedSideHustles,
	saveApplication
} from './store';
import type { Application } from './funnel';
import type { ResumeVersion } from '../api/types';
import type { SideHustle } from './catalog';

afterEach(async () => {
	resetApi();
	await new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase('qingxin');
		request.onsuccess = () => resolve();
		request.onerror = () => resolve();
		request.onblocked = () => resolve();
	});
});

describe('hustle store', () => {
	it('reads cached applications back from IndexedDB', async () => {
		const apps: Application[] = [
			{ id: 'app-1', company: '轻心实验室', position: '前端', status: '投递' }
		];
		await cacheApplications(apps);
		await expect(loadCachedApplications()).resolves.toEqual(apps);
	});

	it('reads cached resumes and side hustles back from IndexedDB', async () => {
		const resumes: ResumeVersion[] = [
			{
				id: 'resume-1',
				version: 1,
				content: { name: '林轻心' },
				createdAt: '2026-10-13T01:00:00Z',
				updatedAt: '2026-10-13T01:00:00Z'
			}
		];
		const hustles: SideHustle[] = [
			{
				id: 'hustle-1',
				title: '文档翻译',
				platform: '线上接单',
				estimatedIncome: 2000,
				skillsRequired: ['英语'],
				kind: '线上'
			}
		];
		await cacheResumes(resumes);
		await cacheSideHustles(hustles);
		await expect(loadCachedResumes()).resolves.toEqual(resumes);
		await expect(loadCachedSideHustles()).resolves.toEqual(hustles);
	});

	it('enqueues an offline create as hustle_application_create', async () => {
		class OfflineApi extends MockQingxinApi {
			override async createApplication(): Promise<Application> {
				throw new ApiError('unavailable', '网络不可用');
			}
		}
		const api = new OfflineApi();
		await api.login('demo@qingxin.app', 'qingxin');
		resetApi(api);
		Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
		await saveApplication(
			{ company: '轻心实验室', position: '前端' },
			() => {},
			() => {}
		);
		const db = await openQingxinDb();
		try {
			const pending = await listPendingSync(db);
			expect(pending.some((op) => op.type === 'hustle_application_create')).toBe(true);
		} finally {
			db.close();
		}
	});
});

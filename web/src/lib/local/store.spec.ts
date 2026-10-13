import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError, MockQingxinApi, resetApi } from '../api/client';
import { listPendingSync, openQingxinDb } from '../offline/cache';
import {
	cacheServices,
	loadCachedServices,
	saveCorrection,
	saveReview,
	saveService
} from './store';
import type { LocalService } from './catalog';

afterEach(async () => {
	resetApi();
	await new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase('qingxin');
		request.onsuccess = () => resolve();
		request.onerror = () => resolve();
		request.onblocked = () => resolve();
	});
});

describe('local store', () => {
	it('reads cached services back from IndexedDB', async () => {
		const services: LocalService[] = [
			{
				id: 'svc-1',
				name: '轻心宠物医院',
				category: '宠物',
				latitude: 31.23,
				longitude: 121.47,
				address: '轻心路 12 号',
				tags: ['有坡道'],
				ratingAvg: 4.8
			}
		];
		await cacheServices(services);
		await expect(loadCachedServices()).resolves.toEqual(services);
	});

	it('queues a review create while offline', async () => {
		class OfflineApi extends MockQingxinApi {
			override async createLocalReview(): Promise<never> {
				throw new ApiError('unavailable', '网络不可用');
			}
		}
		const api = new OfflineApi();
		await api.login('demo@qingxin.app', 'qingxin');
		resetApi(api);
		const listed = await api.listLocalServices();
		Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
		await saveReview(
			listed[0]!.id,
			{ content: '医生很耐心', rating: 5 },
			() => undefined,
			() => undefined
		);
		const db = await openQingxinDb();
		try {
			const pending = await listPendingSync(db);
			expect(pending.some((op) => op.type === 'local_review_create')).toBe(true);
		} finally {
			db.close();
		}
	});

	it('queues a service create while offline', async () => {
		class OfflineApi extends MockQingxinApi {
			override async createLocalService(): Promise<never> {
				throw new ApiError('unavailable', '网络不可用');
			}
		}
		const api = new OfflineApi();
		await api.login('demo@qingxin.app', 'qingxin');
		resetApi(api);
		Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
		await saveService(
			{
				name: '街角修伞铺',
				category: '维修',
				address: '轻心路 8 号',
				latitude: 31.2298,
				longitude: 121.4742
			},
			() => undefined,
			() => undefined
		);
		const db = await openQingxinDb();
		try {
			const pending = await listPendingSync(db);
			expect(pending.some((op) => op.type === 'local_service_create')).toBe(true);
		} finally {
			db.close();
		}
	});

	it('queues a correction create while offline', async () => {
		class OfflineApi extends MockQingxinApi {
			override async createLocalCorrection(): Promise<never> {
				throw new ApiError('unavailable', '网络不可用');
			}
		}
		const api = new OfflineApi();
		await api.login('demo@qingxin.app', 'qingxin');
		resetApi(api);
		const listed = await api.listLocalServices();
		Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
		await saveCorrection(
			listed[0]!.id,
			{ kind: '电话空号' },
			() => undefined,
			() => undefined
		);
		const db = await openQingxinDb();
		try {
			const pending = await listPendingSync(db);
			expect(pending.some((op) => op.type === 'local_correction_create')).toBe(true);
		} finally {
			db.close();
		}
	});

	it('is a typed error instance when the mock is unauthenticated', async () => {
		const api = new MockQingxinApi();
		await expect(api.listLocalServices()).rejects.toBeInstanceOf(ApiError);
	});
});

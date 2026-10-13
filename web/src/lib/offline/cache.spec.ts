import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { drainSync, enqueueSync, getRecord, listPendingSync, openQingxinDb, putRecord } from './cache';

afterEach(async () => {
	await new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase('qingxin');
		request.onsuccess = () => resolve();
		request.onerror = () => resolve();
		request.onblocked = () => resolve();
	});
});

describe('IndexedDB cache', () => {
	it('reads back a stored JSON record', async () => {
		const db = await openQingxinDb();
		try {
			await putRecord(db, 'modules', 'hub', { names: ['健康', '宠物'] });
			await expect(getRecord(db, 'modules', 'hub')).resolves.toEqual({
				names: ['健康', '宠物']
			});
		} finally {
			db.close();
		}
	});

	it('returns undefined for a missing key', async () => {
		const db = await openQingxinDb();
		try {
			await expect(getRecord(db, 'modules', 'missing')).resolves.toBeUndefined();
		} finally {
			db.close();
		}
	});

	it('queues mutations and drains them silently in order', async () => {
		const db = await openQingxinDb();
		try {
			await enqueueSync(db, { type: 'export', payload: { step: 1 } });
			await enqueueSync(db, { type: 'export', payload: { step: 2 } });

			const seen: number[] = [];
			await drainSync(db, async (op) => {
				seen.push((op.payload as { step: number }).step);
			});

			expect(seen).toEqual([1, 2]);
			await expect(listPendingSync(db)).resolves.toEqual([]);
		} finally {
			db.close();
		}
	});

	it('keeps an item on the queue when the handler fails', async () => {
		const db = await openQingxinDb();
		try {
			await enqueueSync(db, { type: 'login', payload: { email: 'a@b.c' } });

			await expect(
				drainSync(db, async () => {
					throw new Error('offline');
				})
			).rejects.toThrow('offline');

			const pending = await listPendingSync(db);
			expect(pending).toHaveLength(1);
			expect(pending[0]?.type).toBe('login');
		} finally {
			db.close();
		}
	});
});

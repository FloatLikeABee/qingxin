import { getApi } from '../api/mock';
import { enqueueSync, openQingxinDb, putRecord } from '../offline/cache';
import { optimistic } from '../optimistic';
import type { MoodLog } from './trends';
import type { CreateMoodLogInput } from '../api/types';

const CACHE_STORE = 'mood';

export async function cacheLogs(logs: MoodLog[]): Promise<void> {
	const db = await openQingxinDb();
	try {
		await putRecord(db, CACHE_STORE, 'logs', logs);
	} finally {
		db.close();
	}
}

export async function saveCheckIn(input: CreateMoodLogInput, apply: (log: MoodLog) => void, revert: () => void) {
	const pending: MoodLog = {
		id: input.id ?? crypto.randomUUID(),
		emoji: input.emoji,
		score: 0,
		tags: input.tags,
		note: input.note ?? null,
		createdAt: new Date().toISOString()
	};
	return optimistic(
		() => apply(pending),
		revert,
		async () => {
			try {
				const saved = await getApi().createMoodLog({ ...input, id: pending.id });
				return saved;
			} catch (error) {
				if (typeof navigator !== 'undefined' && !navigator.onLine) {
					const db = await openQingxinDb();
					try {
						await enqueueSync(db, { type: 'mood_log_create', payload: { ...input, id: pending.id } });
					} finally {
						db.close();
					}
					return pending;
				}
				throw error;
			}
		}
	);
}

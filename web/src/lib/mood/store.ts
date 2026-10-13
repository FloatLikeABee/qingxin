import { getApi } from '../api/mock';
import type { MeditationKind, MeditationSession } from '../api/types';
import { enqueueSync, getRecord, openQingxinDb, putRecord } from '../offline/cache';
import { optimistic } from '../optimistic';
import { MOOD_EMOJIS } from './catalog';
import type { MoodLog } from './trends';
import type { CreateMoodLogInput } from '../api/types';

const CACHE_STORE = 'mood';

function plain<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

export async function cacheLogs(logs: MoodLog[]): Promise<void> {
	const db = await openQingxinDb();
	try {
		await putRecord(db, CACHE_STORE, 'logs', plain(logs));
	} finally {
		db.close();
	}
}

export async function loadCachedLogs(): Promise<MoodLog[]> {
	const db = await openQingxinDb();
	try {
		return (await getRecord<MoodLog[]>(db, CACHE_STORE, 'logs')) ?? [];
	} finally {
		db.close();
	}
}

export async function cacheSessions(sessions: MeditationSession[]): Promise<void> {
	const db = await openQingxinDb();
	try {
		await putRecord(db, CACHE_STORE, 'sessions', plain(sessions));
	} finally {
		db.close();
	}
}

export async function saveCheckIn(input: CreateMoodLogInput, apply: (log: MoodLog) => void, revert: () => void) {
	const pending: MoodLog = {
		id: input.id ?? crypto.randomUUID(),
		emoji: input.emoji,
		score: MOOD_EMOJIS.find((face) => face.glyph === input.emoji)?.score ?? 3,
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

export async function saveMeditationSession(input: {
	id?: string;
	kind: MeditationKind;
	durationSec: number;
	payload?: Record<string, unknown>;
}): Promise<MeditationSession> {
	const pending: MeditationSession = {
		id: input.id ?? crypto.randomUUID(),
		kind: input.kind,
		durationSec: input.durationSec,
		payload: input.payload ?? {},
		startedAt: new Date().toISOString(),
		endedAt: new Date().toISOString()
	};
	try {
		return await getApi().createMeditationSession({ ...input, id: pending.id });
	} catch (error) {
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			const db = await openQingxinDb();
			try {
				await enqueueSync(db, {
					type: 'meditation_session_create',
					payload: { ...input, id: pending.id }
				});
			} finally {
				db.close();
			}
			return pending;
		}
		throw error;
	}
}

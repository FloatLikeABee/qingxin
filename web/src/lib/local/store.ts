import { getApi } from '../api/client';
import { enqueueSync, getRecord, openQingxinDb, putRecord } from '../offline/cache';
import { optimistic } from '../optimistic';
import type {
	CorrectionKind,
	ElderTag,
	LocalCategory,
	LocalCorrection,
	LocalReview,
	LocalService
} from './catalog';

const CACHE_STORE = 'local';

function plain<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

async function cacheList<T>(key: string, items: T[]): Promise<void> {
	const db = await openQingxinDb();
	try {
		await putRecord(db, CACHE_STORE, key, plain(items));
	} finally {
		db.close();
	}
}

async function loadCachedList<T>(key: string): Promise<T[]> {
	const db = await openQingxinDb();
	try {
		return (await getRecord<T[]>(db, CACHE_STORE, key)) ?? [];
	} finally {
		db.close();
	}
}

export async function cacheServices(items: LocalService[]): Promise<void> {
	await cacheList('services', items);
}

export async function loadCachedServices(): Promise<LocalService[]> {
	return loadCachedList<LocalService>('services');
}

export async function cacheReviews(serviceId: string, items: LocalReview[]): Promise<void> {
	await cacheList(`reviews:${serviceId}`, items);
}

export async function loadCachedReviews(serviceId: string): Promise<LocalReview[]> {
	return loadCachedList<LocalReview>(`reviews:${serviceId}`);
}

async function queueIfOffline<T>(
	type: string,
	payload: unknown,
	pending: T,
	error: unknown
): Promise<T> {
	if (typeof navigator !== 'undefined' && !navigator.onLine) {
		const db = await openQingxinDb();
		try {
			await enqueueSync(db, { type, payload });
		} finally {
			db.close();
		}
		return pending;
	}
	throw error;
}

export async function saveReview(
	serviceId: string,
	input: { id?: string; content: string; rating?: number },
	apply: (review: LocalReview) => void,
	revert: () => void
) {
	const pending: LocalReview = {
		id: input.id ?? crypto.randomUUID(),
		serviceId,
		userId: 'pending',
		content: input.content,
		rating: input.rating,
		createdAt: new Date().toISOString()
	};
	return optimistic(
		() => apply(pending),
		revert,
		async () => {
			try {
				return await getApi().createLocalReview(serviceId, { ...input, id: pending.id });
			} catch (error) {
				return queueIfOffline(
					'local_review_create',
					{ serviceId, ...input, id: pending.id },
					pending,
					error
				);
			}
		}
	);
}

export async function saveService(
	input: {
		id?: string;
		name: string;
		category: LocalCategory;
		address: string;
		latitude: number;
		longitude: number;
		hours?: string;
		phone?: string;
		tags?: ElderTag[];
	},
	apply: (service: LocalService) => void,
	revert: () => void
) {
	const pending: LocalService = {
		id: input.id ?? crypto.randomUUID(),
		name: input.name,
		category: input.category,
		address: input.address,
		latitude: input.latitude,
		longitude: input.longitude,
		tags: input.tags ?? [],
		ratingAvg: 0,
		hours: input.hours,
		phone: input.phone,
		createdAt: new Date().toISOString()
	};
	return optimistic(
		() => apply(pending),
		revert,
		async () => {
			try {
				return await getApi().createLocalService({ ...input, id: pending.id });
			} catch (error) {
				return queueIfOffline('local_service_create', { ...input, id: pending.id }, pending, error);
			}
		}
	);
}

export async function saveCorrection(
	serviceId: string,
	input: { id?: string; kind: CorrectionKind },
	apply: (row: LocalCorrection) => void,
	revert: () => void
) {
	const pending: LocalCorrection = {
		id: input.id ?? crypto.randomUUID(),
		serviceId,
		userId: 'pending',
		kind: input.kind,
		createdAt: new Date().toISOString()
	};
	return optimistic(
		() => apply(pending),
		revert,
		async () => {
			try {
				return await getApi().createLocalCorrection(serviceId, { ...input, id: pending.id });
			} catch (error) {
				return queueIfOffline(
					'local_correction_create',
					{ serviceId, ...input, id: pending.id },
					pending,
					error
				);
			}
		}
	);
}

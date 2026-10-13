import { getApi } from '../api/client';
import type { ResumeVersion } from '../api/types';
import type { SideHustle } from './catalog';
import type { Application } from './funnel';
import { enqueueSync, getRecord, openQingxinDb, putRecord } from '../offline/cache';
import { optimistic } from '../optimistic';

const CACHE_STORE = 'hustle';

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

export async function cacheApplications(apps: Application[]): Promise<void> {
	await cacheList('applications', apps);
}

export async function loadCachedApplications(): Promise<Application[]> {
	return loadCachedList<Application>('applications');
}

export async function cacheResumes(rows: ResumeVersion[]): Promise<void> {
	await cacheList('resumes', rows);
}

export async function loadCachedResumes(): Promise<ResumeVersion[]> {
	return loadCachedList<ResumeVersion>('resumes');
}

export async function cacheSideHustles(rows: SideHustle[]): Promise<void> {
	await cacheList('side_hustles', rows);
}

export async function loadCachedSideHustles(): Promise<SideHustle[]> {
	return loadCachedList<SideHustle>('side_hustles');
}

export async function saveApplication(
	input: { id?: string; company: string; position: string; status?: Application['status'] },
	apply: (app: Application) => void,
	revert: () => void
) {
	const pending: Application = {
		id: input.id ?? crypto.randomUUID(),
		company: input.company,
		position: input.position,
		status: input.status ?? '投递'
	};
	return optimistic(
		() => apply(pending),
		revert,
		async () => {
			try {
				return await getApi().createApplication({ ...input, id: pending.id });
			} catch (error) {
				if (typeof navigator !== 'undefined' && !navigator.onLine) {
					const db = await openQingxinDb();
					try {
						await enqueueSync(db, {
							type: 'hustle_application_create',
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
	);
}

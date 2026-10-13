import { getApi } from '../api/mock';
import type { AiTask, ToolCatalog } from '../api/types';
import { enqueueSync, getRecord, openQingxinDb, putRecord } from '../offline/cache';
import type { ToolId } from './catalog';

const CACHE_STORE = 'tools';

function plain<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

export async function cacheTasks(items: AiTask[]): Promise<void> {
	const db = await openQingxinDb();
	try {
		await putRecord(db, CACHE_STORE, 'tasks', plain(items));
	} finally {
		db.close();
	}
}

export async function loadCachedTasks(): Promise<AiTask[]> {
	const db = await openQingxinDb();
	try {
		return (await getRecord<AiTask[]>(db, CACHE_STORE, 'tasks')) ?? [];
	} finally {
		db.close();
	}
}

export async function cacheCatalog(catalog: ToolCatalog): Promise<void> {
	const db = await openQingxinDb();
	try {
		await putRecord(db, CACHE_STORE, 'catalog', plain(catalog));
	} finally {
		db.close();
	}
}

export async function loadCachedCatalog(): Promise<ToolCatalog | undefined> {
	const db = await openQingxinDb();
	try {
		return await getRecord<ToolCatalog>(db, CACHE_STORE, 'catalog');
	} finally {
		db.close();
	}
}

export async function toggleFavourite(toolId: ToolId, favourite: boolean) {
	try {
		return await getApi().setToolFavourite(toolId, favourite);
	} catch (error) {
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			const db = await openQingxinDb();
			try {
				await enqueueSync(db, { type: 'tools_favourite', payload: { toolId, favourite } });
			} finally {
				db.close();
			}
			return { toolId, favourite };
		}
		throw error;
	}
}

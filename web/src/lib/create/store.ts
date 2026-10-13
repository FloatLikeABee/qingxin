import { getApi } from '../api/mock';
import type { Creation, CreateSnippet } from '../api/types';
import { enqueueSync, getRecord, openQingxinDb, putRecord } from '../offline/cache';
import { optimistic } from '../optimistic';
import type { CreatePlatform } from './catalog';

const CACHE_STORE = 'create';

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

export async function cacheCreations(items: Creation[]): Promise<void> {
	await cacheList('creations', items);
}

export async function loadCachedCreations(): Promise<Creation[]> {
	return loadCachedList<Creation>('creations');
}

export async function cacheSnippets(items: CreateSnippet[]): Promise<void> {
	await cacheList('snippets', items);
}

export async function loadCachedSnippets(): Promise<CreateSnippet[]> {
	return loadCachedList<CreateSnippet>('snippets');
}

export async function saveCreation(
	input: {
		id?: string;
		platform: CreatePlatform;
		promptParams?: Record<string, unknown>;
		generatedContent: string;
		finalContent?: string;
		title?: string;
	},
	apply: (work: Creation) => void,
	revert: () => void
) {
	if (input.id) {
		const saved = await getApi().patchCreation(input.id, {
			title: input.title,
			generatedContent: input.generatedContent,
			finalContent: input.finalContent,
			promptParams: input.promptParams
		});
		apply(saved);
		return saved;
	}
	const now = new Date().toISOString();
	const generated = input.generatedContent;
	const finalContent = input.finalContent ?? generated;
	const versions = [{ at: now, kind: 'generate', content: generated }];
	if (finalContent !== generated) {
		versions.push({ at: now, kind: 'edit', content: finalContent });
	}
	const pending: Creation = {
		id: crypto.randomUUID(),
		platform: input.platform,
		title: input.title,
		promptParams: input.promptParams,
		generatedContent: generated,
		finalContent,
		versions,
		createdAt: now,
		updatedAt: now
	};
	return optimistic(
		() => apply(pending),
		revert,
		async () => {
			try {
				return await getApi().createCreation({ ...input, id: pending.id });
			} catch (error) {
				if (typeof navigator !== 'undefined' && !navigator.onLine) {
					const db = await openQingxinDb();
					try {
						await enqueueSync(db, {
							type: 'create_work_create',
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

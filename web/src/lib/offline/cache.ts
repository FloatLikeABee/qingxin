export const DB_NAME = 'qingxin';
export const DB_VERSION = 1;
export const RECORDS_STORE = 'records';
export const SYNC_STORE = 'sync';

export interface SyncOp {
	id: string;
	type: string;
	payload: unknown;
	createdAt: number;
}

export interface EnqueueInput {
	type: string;
	payload: unknown;
}

function recordKey(store: string, key: string): string {
	return `${store}:${key}`;
}

export function openQingxinDb(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = factory.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(RECORDS_STORE)) {
				db.createObjectStore(RECORDS_STORE);
			}
			if (!db.objectStoreNames.contains(SYNC_STORE)) {
				db.createObjectStore(SYNC_STORE, { keyPath: 'id' });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('无法打开本地缓存'));
	});
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('IndexedDB 操作失败'));
	});
}

function transactionDone(tx: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? new Error('IndexedDB 事务失败'));
		tx.onabort = () => reject(tx.error ?? new Error('IndexedDB 事务中止'));
	});
}

export async function putRecord<T>(db: IDBDatabase, store: string, key: string, value: T): Promise<void> {
	const tx = db.transaction(RECORDS_STORE, 'readwrite');
	tx.objectStore(RECORDS_STORE).put(value, recordKey(store, key));
	await transactionDone(tx);
}

export async function getRecord<T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> {
	const tx = db.transaction(RECORDS_STORE, 'readonly');
	const value = await requestToPromise(tx.objectStore(RECORDS_STORE).get(recordKey(store, key)));
	return value as T | undefined;
}

let enqueueSeq = 0;

export async function enqueueSync(db: IDBDatabase, input: EnqueueInput): Promise<SyncOp> {
	const op: SyncOp = {
		id: crypto.randomUUID(),
		type: input.type,
		payload: input.payload,
		createdAt: Date.now() * 1000 + ++enqueueSeq
	};
	const tx = db.transaction(SYNC_STORE, 'readwrite');
	tx.objectStore(SYNC_STORE).put(op);
	await transactionDone(tx);
	return op;
}

export async function listPendingSync(db: IDBDatabase): Promise<SyncOp[]> {
	const tx = db.transaction(SYNC_STORE, 'readonly');
	const rows = await requestToPromise(tx.objectStore(SYNC_STORE).getAll());
	return (rows as SyncOp[]).sort((a, b) => a.createdAt - b.createdAt);
}

export async function drainSync(
	db: IDBDatabase,
	handler: (op: SyncOp) => Promise<void>
): Promise<void> {
	const pending = await listPendingSync(db);
	for (const op of pending) {
		await handler(op);
		const tx = db.transaction(SYNC_STORE, 'readwrite');
		tx.objectStore(SYNC_STORE).delete(op.id);
		await transactionDone(tx);
	}
}

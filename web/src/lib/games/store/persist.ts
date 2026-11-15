import type { DaySummary } from './sim';

export const STORE_SAVE_KEY = 'qingxin.games.convenient-store';

export interface StoreSave {
	bestRevenue: number;
	bestSatisfaction: number;
}

const emptySave = (): StoreSave => ({ bestRevenue: 0, bestSatisfaction: 0 });

export function readStoreSave(
	storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage
): StoreSave {
	try {
		const raw = storage?.getItem(STORE_SAVE_KEY);
		if (!raw) return emptySave();
		const parsed = JSON.parse(raw) as Partial<StoreSave>;
		return {
			bestRevenue: Number(parsed.bestRevenue) || 0,
			bestSatisfaction: Number(parsed.bestSatisfaction) || 0
		};
	} catch {
		return emptySave();
	}
}

export function writeDayResult(
	summary: DaySummary,
	storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage
): StoreSave {
	const previous = readStoreSave(storage);
	const next: StoreSave = {
		bestRevenue: Math.max(previous.bestRevenue, summary.revenue),
		bestSatisfaction: Math.max(previous.bestSatisfaction, summary.satisfaction)
	};
	try {
		storage?.setItem(STORE_SAVE_KEY, JSON.stringify(next));
	} catch {
		// private mode / quota
	}
	return next;
}

import type { FloristSummary } from './sim';

export const FLORIST_SAVE_KEY = 'qingxin.games.corner-florist';

export interface FloristSave {
	bestSatisfaction: number;
	bestHappy: number;
}

const empty = (): FloristSave => ({ bestSatisfaction: 0, bestHappy: 0 });

export function readFloristSave(
	storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage
): FloristSave {
	try {
		const raw = storage?.getItem(FLORIST_SAVE_KEY);
		if (!raw) return empty();
		const parsed = JSON.parse(raw) as Partial<FloristSave>;
		return {
			bestSatisfaction: Number(parsed.bestSatisfaction) || 0,
			bestHappy: Number(parsed.bestHappy) || 0
		};
	} catch {
		return empty();
	}
}

export function writeFloristResult(
	summary: FloristSummary,
	storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage
): FloristSave {
	const previous = readFloristSave(storage);
	const next: FloristSave = {
		bestSatisfaction: Math.max(previous.bestSatisfaction, summary.satisfaction),
		bestHappy: Math.max(previous.bestHappy, summary.happy)
	};
	try {
		storage?.setItem(FLORIST_SAVE_KEY, JSON.stringify(next));
	} catch {
		// private mode
	}
	return next;
}

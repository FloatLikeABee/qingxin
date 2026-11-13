export const NIGHT_SAVE_KEY = 'qingxin.games.night-puzzle';

export interface NightSave {
	bestMisses: number;
	bestTicks: number;
}

const empty = (): NightSave => ({
	bestMisses: Number.POSITIVE_INFINITY,
	bestTicks: Number.POSITIVE_INFINITY
});

export function readNightSave(
	storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage
): NightSave {
	try {
		const raw = storage?.getItem(NIGHT_SAVE_KEY);
		if (!raw) return empty();
		const parsed = JSON.parse(raw) as Partial<NightSave>;
		return {
			bestMisses: Number.isFinite(Number(parsed.bestMisses))
				? Number(parsed.bestMisses)
				: Number.POSITIVE_INFINITY,
			bestTicks: Number.isFinite(Number(parsed.bestTicks))
				? Number(parsed.bestTicks)
				: Number.POSITIVE_INFINITY
		};
	} catch {
		return empty();
	}
}

export function writeNightResult(
	misses: number,
	ticks: number,
	storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage
): NightSave {
	const previous = readNightSave(storage);
	const next: NightSave = {
		bestMisses: Math.min(previous.bestMisses, misses),
		bestTicks: Math.min(previous.bestTicks, ticks)
	};
	try {
		storage?.setItem(NIGHT_SAVE_KEY, JSON.stringify(next));
	} catch {
		// private mode
	}
	return next;
}

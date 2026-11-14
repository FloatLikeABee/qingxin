export const SHOOTER_SAVE_KEY = 'qingxin.games.sky-sortie';

export interface ShooterSave {
	best: number;
}

const emptySave = (): ShooterSave => ({ best: 0 });

export function readShooterSave(
	storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage
): ShooterSave {
	try {
		const raw = storage?.getItem(SHOOTER_SAVE_KEY);
		if (!raw) return emptySave();
		const parsed = JSON.parse(raw) as Partial<ShooterSave>;
		const best = Number(parsed.best);
		return { best: Number.isFinite(best) && best > 0 ? best : 0 };
	} catch {
		return emptySave();
	}
}

export function writeShooterScore(
	score: number,
	storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage
): ShooterSave {
	const previous = readShooterSave(storage);
	const next: ShooterSave = { best: Math.max(previous.best, score) };
	try {
		storage?.setItem(SHOOTER_SAVE_KEY, JSON.stringify(next));
	} catch {
		// private mode / quota
	}
	return next;
}

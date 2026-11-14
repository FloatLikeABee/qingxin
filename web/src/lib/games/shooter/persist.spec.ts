import { describe, expect, it } from 'vitest';
import { readShooterSave, SHOOTER_SAVE_KEY, writeShooterScore } from './persist';

function memory() {
	const data = new Map<string, string>();
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => {
			data.set(key, value);
		}
	};
}

describe('sky-sortie save', () => {
	it('keeps the best score only', () => {
		const storage = memory();
		expect(readShooterSave(storage)).toEqual({ best: 0 });
		writeShooterScore(120, storage);
		expect(writeShooterScore(80, storage)).toEqual({ best: 120 });
		expect(writeShooterScore(400, storage)).toEqual({ best: 400 });
		expect(storage.getItem(SHOOTER_SAVE_KEY)).toContain('400');
	});

	it('recovers from corrupt JSON', () => {
		const storage = memory();
		storage.setItem(SHOOTER_SAVE_KEY, '{nope');
		expect(readShooterSave(storage)).toEqual({ best: 0 });
	});
});

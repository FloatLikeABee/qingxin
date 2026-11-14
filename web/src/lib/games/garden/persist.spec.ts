import { describe, expect, it } from 'vitest';
import { createGarden, plantSeed } from './sim';
import { readGardenSave, writeGardenSave } from './persist';

function memory(initial?: Record<string, string>) {
	const data = new Map<string, string>(Object.entries(initial ?? {}));
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => {
			data.set(key, value);
		}
	};
}

describe('window-garden save', () => {
	it('round-trips a planted bed', () => {
		const storage = memory();
		const garden = createGarden({ seed: 1, autoBugs: false });
		plantSeed(garden, 2, 'tomato');
		writeGardenSave(garden, storage);
		const loaded = readGardenSave(storage);
		expect(loaded.recovered).toBe(false);
		expect(loaded.beds[2]?.plantId).toBe('tomato');
		expect(loaded.beds[2]?.stage).toBe('seed');
		expect(loaded.coins).toBe(garden.coins);
	});

	it('recovers from corrupt JSON', () => {
		const storage = memory();
		storage.setItem('qingxin.games.window-garden', '{nope');
		const loaded = readGardenSave(storage);
		expect(loaded.recovered).toBe(true);
		expect(loaded.beds).toHaveLength(12);
		expect(loaded.seeds.tomato).toBeGreaterThan(0);
	});

	it('recovers from a missing schema', () => {
		const storage = memory();
		storage.setItem('qingxin.games.window-garden', JSON.stringify({ coins: 9 }));
		expect(readGardenSave(storage).recovered).toBe(true);
	});

	it('clears unknown plant ids', () => {
		const storage = memory();
		const garden = createGarden({ seed: 1, autoBugs: false });
		plantSeed(garden, 0, 'tomato');
		writeGardenSave(garden, storage);
		const raw = JSON.parse(storage.getItem('qingxin.games.window-garden') ?? '{}') as {
			beds: { plantId: string }[];
		};
		raw.beds[0]!.plantId = 'not-a-plant';
		storage.setItem('qingxin.games.window-garden', JSON.stringify(raw));
		const loaded = readGardenSave(storage);
		expect(loaded.beds[0]?.plantId).toBeNull();
		expect(loaded.beds[0]?.stage).toBe('empty');
		expect(loaded.recovered).toBe(false);
	});
});

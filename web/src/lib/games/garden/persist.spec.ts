import { describe, expect, it } from 'vitest';
import { createGarden, plantSeed } from './sim';
import { GARDEN_SCHEMA, readGardenSave, writeGardenSave } from './persist';

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
		expect(GARDEN_SCHEMA).toBe(2);
	});

	it('migrates a c358d29 schema-1 save without losing plants', () => {
		const storage = memory();
		storage.setItem(
			'qingxin.games.window-garden',
			JSON.stringify({
				schema: 1,
				tick: 40,
				coins: 52,
				waterCan: 7,
				fertilizer: 3,
				harvests: 5,
				seeds: { tomato: 2, mint: 1 },
				beds: Array.from({ length: 12 }, (_, id) => ({
					id,
					plantId: id === 2 ? 'tomato' : null,
					stage: id === 2 ? 'leaf' : 'empty',
					progress: id === 2 ? 4 : 0,
					water: 2,
					light: 2,
					nutrient: 1,
					health: 3,
					shade: false,
					bugs: id === 2 ? [{ id: 4, kind: 'bee' }] : []
				})),
				nextId: 5
			})
		);
		const loaded = readGardenSave(storage);
		expect(loaded.recovered).toBe(false);
		expect(loaded.beds[2]?.plantId).toBe('tomato');
		expect(loaded.beds[2]?.stage).toBe('leaf');
		expect(loaded.coins).toBe(52);
		expect(loaded.harvests).toBe(5);
		expect(loaded.seeds.tomato).toBe(2);
		expect(loaded.beds[2]?.potSize).toBe(1);
		expect(loaded.bugs.some((bug) => bug.kind === 'bee' && bug.phase === 'visit')).toBe(true);
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

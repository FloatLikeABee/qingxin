import { describe, expect, it } from 'vitest';
import { KITCHEN_SAVE_KEY, KITCHEN_SCHEMA, readKitchenSave, writeKitchenSave } from './persist';
import { createKitchen, dropOnPan, pickBowl, setHeat } from './sim';

function memory(initial?: Record<string, string>) {
	const data = new Map<string, string>(Object.entries(initial ?? {}));
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => {
			data.set(key, value);
		}
	};
}

const SIBLINGS: Record<string, string> = {
	'qingxin.theme': 'dark',
	'qingxin.games.cargo-haul': '{"schema":2}',
	'qingxin.games.cloud-walk': '{"schema":3}',
	'qingxin.games.operation': '{"schema":2}',
	'qingxin.games.memory-shelf': '{"schema":3}',
	'qingxin.games.annual-report': '{"schema":1}',
	'qingxin.games.tide-breath': '{"schema":1}',
	'qingxin.games.convenient-store': '{"schema":1}',
	'qingxin.games.story-clinic': '{"schema":1}'
};

describe('home-kitchen save', () => {
	it('round-trips pan pieces, plated dishes, and settings without wiping sibling keys', () => {
		const storage = memory(SIBLINGS);
		const world = createKitchen();
		pickBowl(world, 'veg');
		dropOnPan(world, 0.2, -0.1);
		pickBowl(world, 'egg');
		dropOnPan(world, -0.2, 0.1);
		setHeat(world, 'high');
		world.lowDetail = true;
		world.audioWanted = true;
		world.dockCollapsed = true;
		writeKitchenSave(world, storage);
		const loaded = readKitchenSave(storage);
		expect(loaded.recovered).toBe(false);
		expect(loaded.pan).toHaveLength(2);
		expect(loaded.pan[0]).toMatchObject({ kind: 'veg', x: 0.2, z: -0.1 });
		expect(loaded.pan[1]?.kind).toBe('egg');
		expect(loaded.lowDetail).toBe(true);
		expect(loaded.audioWanted).toBe(true);
		expect(loaded.dockCollapsed).toBe(true);
		expect(loaded.heat).toBe('off');
		expect(KITCHEN_SCHEMA).toBe(1);
		expect(KITCHEN_SAVE_KEY).toBe('qingxin.games.home-kitchen');
		for (const [key, value] of Object.entries(SIBLINGS)) {
			expect(storage.getItem(key)).toBe(value);
		}
	});

	it('recovers foreign schema and corrupt JSON without wiping theme', () => {
		const foreign = memory({
			...SIBLINGS,
			[KITCHEN_SAVE_KEY]: JSON.stringify({ schema: 9, pan: [{ kind: 'veg' }] })
		});
		const recovered = readKitchenSave(foreign);
		expect(recovered.recovered).toBe(true);
		expect(recovered.pan).toHaveLength(0);
		expect(recovered.notice).toMatch(/厨房重新收拾好了/);
		expect(foreign.getItem('qingxin.theme')).toBe('dark');
		expect(foreign.getItem('qingxin.games.cargo-haul')).toBe('{"schema":2}');

		const bad = memory({
			'qingxin.theme': 'light',
			[KITCHEN_SAVE_KEY]: '{nope'
		});
		const broken = readKitchenSave(bad);
		expect(broken.recovered).toBe(true);
		expect(broken.pan).toHaveLength(0);
		expect(bad.getItem('qingxin.theme')).toBe('light');
	});
});

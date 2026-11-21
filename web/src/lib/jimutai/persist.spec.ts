import { describe, expect, it } from 'vitest';
import { JIMUTAI_SAVE_KEY, JIMUTAI_SCHEMA, readJimutaiSave, writeJimutaiSave } from './persist';
import { createWorld, placeAt, rotateSelected, undoLast } from './world';

function memory(initial?: Record<string, string>) {
	const data = new Map<string, string>(Object.entries(initial ?? {}));
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => {
			data.set(key, value);
		},
		removeItem: (key: string) => {
			data.delete(key);
		}
	};
}

describe('积木台 save', () => {
	it('round-trips tray, placed pieces, rotation, camera, and undo', () => {
		const storage = memory();
		const world = createWorld();
		rotateSelected(world, 'y');
		expect(placeAt(world, { x: 2, y: 0, z: 2 })).toBe(true);
		world.camera.yaw = 1.1;
		world.camera.distance = 8;
		writeJimutaiSave(world, storage);
		const loaded = readJimutaiSave(storage);
		expect(loaded.recovered).toBe(false);
		expect(loaded.placed).toHaveLength(1);
		expect(loaded.tray).toHaveLength(4);
		expect(loaded.placed[0]?.rotY).toBe(1);
		expect(loaded.camera.yaw).toBeCloseTo(1.1);
		expect(undoLast(loaded)).toBe(true);
		expect(loaded.placed).toHaveLength(0);
		expect(loaded.tray).toHaveLength(5);
		expect(JIMUTAI_SCHEMA).toBe(1);
		expect(JIMUTAI_SAVE_KEY).toBe('qingxin.jimutai');
	});

	it('recovers corrupt JSON without touching sibling game or hustle keys', () => {
		const storage = memory({
			'qingxin.games.window-garden': '{"schema":3,"coins":9}',
			'qingxin.shangban': '{"schema":1}',
			'qingxin.hustleApplications': '[]',
			[JIMUTAI_SAVE_KEY]: '{nope'
		});
		const loaded = readJimutaiSave(storage);
		expect(loaded.recovered).toBe(true);
		expect(loaded.tray).toHaveLength(5);
		expect(loaded.placed).toHaveLength(0);
		expect(storage.getItem('qingxin.games.window-garden')).toBe('{"schema":3,"coins":9}');
		expect(storage.getItem('qingxin.shangban')).toBe('{"schema":1}');
		expect(storage.getItem('qingxin.hustleApplications')).toBe('[]');
		expect(storage.getItem(JIMUTAI_SAVE_KEY)).toBe('{nope');
	});

	it('treats an unknown schema as a fresh table', () => {
		const missing = readJimutaiSave(memory());
		expect(missing.tray).toHaveLength(5);
		expect(missing.recovered).toBe(false);
		const weird = readJimutaiSave(
			memory({ [JIMUTAI_SAVE_KEY]: JSON.stringify({ schema: 99, tray: [] }) })
		);
		expect(weird.recovered).toBe(true);
		expect(weird.notice).toMatch(/存档/);
	});
});

import { describe, expect, it } from 'vitest';
import { collectFragment, createSky, setSkyKey, stepSky } from './sim';
import { CLOUD_SAVE_KEY, CLOUD_SCHEMA, readSkySave, writeSkySave } from './persist';

function memory(initial?: Record<string, string>) {
	const data = new Map<string, string>(Object.entries(initial ?? {}));
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => {
			data.set(key, value);
		}
	};
}

describe('cloud-walk save', () => {
	it('round-trips fragments, garden, visited isles, and settings', () => {
		const storage = memory();
		const world = createSky();
		setSkyKey(world, 'right', true);
		for (let i = 0; i < 200; i++) stepSky(world, 80);
		if (!world.fragments.some((f) => f.collected)) collectFragment(world, 'sun');
		world.lowDetail = true;
		world.audioWanted = true;
		world.dockCollapsed = true;
		writeSkySave(world, storage);
		const loaded = readSkySave(storage);
		expect(loaded.recovered).toBe(false);
		expect(loaded.fragments.some((f) => f.collected)).toBe(true);
		expect(loaded.garden.length).toBeGreaterThanOrEqual(1);
		expect(loaded.skyMode).not.toBe('dawn');
		expect(
			loaded.visited.includes(1) || loaded.island >= 1 || loaded.biomes.includes('alien')
		).toBe(true);
		expect(loaded.lowDetail).toBe(true);
		expect(loaded.audioWanted).toBe(true);
		expect(loaded.dockCollapsed).toBe(true);
		expect(CLOUD_SCHEMA).toBe(2);
		expect(CLOUD_SAVE_KEY).toBe('qingxin.games.cloud-walk');
	});

	it('migrates a schema 1 save without wiping fragments, garden, or other keys', () => {
		const storage = memory({
			'qingxin.theme': 'dark',
			'qingxin.games.tide-breath': '{"schema":1}',
			'qingxin.games.cloud-walk': JSON.stringify({
				schema: 1,
				x: 0,
				y: 0,
				z: 0,
				yaw: 1.18,
				island: 0,
				visited: [0, 1],
				skyMode: 'sun',
				fragments: [
					{ id: 1, kind: 'sun', collected: true },
					{ id: 2, kind: 'rain', collected: true },
					{ id: 3, kind: 'breeze', collected: false },
					{ id: 4, kind: 'night', collected: false }
				],
				garden: [
					{ kind: 'sun', x: -1.45, z: -1.65, grown: 0.8 },
					{ kind: 'rain', x: 0.25, z: -2.05, grown: 0.4 }
				],
				lowDetail: false,
				audioWanted: true,
				dockCollapsed: false
			})
		});
		const loaded = readSkySave(storage);
		expect(loaded.recovered).toBe(false);
		expect(
			loaded.fragments
				.filter((f) => f.collected)
				.map((f) => f.kind)
				.sort()
		).toEqual(['rain', 'sun']);
		expect(loaded.garden.map((p) => p.kind).sort()).toEqual(['rain', 'sun']);
		expect(loaded.skyMode).toBe('sun');
		expect(loaded.biomes).toContain('garden');
		expect(loaded.biomes).toContain('alien');
		expect(loaded.audioWanted).toBe(true);
		expect(storage.getItem('qingxin.theme')).toBe('dark');
		expect(storage.getItem('qingxin.games.tide-breath')).toBe('{"schema":1}');
		expect(storage.getItem('qingxin.games.cloud-walk')).toContain('"schema":2');
	});

	it('recovers a corrupt save without throwing', () => {
		const storage = memory({ 'qingxin.games.cloud-walk': '{nope' });
		const loaded = readSkySave(storage);
		expect(loaded.recovered).toBe(true);
		expect(loaded.garden).toHaveLength(0);
		expect(loaded.notice).toMatch(/从头/);
	});

	it('clamps a schema 1 position outside the new cylinder back home', () => {
		const storage = memory({
			'qingxin.theme': 'light',
			'qingxin.games.cloud-walk': JSON.stringify({
				schema: 1,
				x: 80,
				y: 40,
				z: -70,
				yaw: 0.2,
				island: 0,
				visited: [0],
				skyMode: 'dawn',
				fragments: [
					{ id: 1, kind: 'sun', collected: false },
					{ id: 2, kind: 'rain', collected: false },
					{ id: 3, kind: 'breeze', collected: false },
					{ id: 4, kind: 'night', collected: false }
				],
				garden: []
			})
		});
		const loaded = readSkySave(storage);
		expect(loaded.x).toBe(0);
		expect(loaded.y).toBe(1);
		expect(loaded.z).toBe(0);
		expect(loaded.notice).toMatch(/云界变大了/);
		expect(storage.getItem('qingxin.theme')).toBe('light');
	});

	it('keeps schema 2 biomes including water after a round-trip', () => {
		const storage = memory();
		const world = createSky();
		world.biomes = ['garden', 'water', 'underworld'];
		world.x = 0.2;
		world.y = -8;
		world.z = -0.55;
		writeSkySave(world, storage);
		const loaded = readSkySave(storage);
		expect(JSON.parse(storage.getItem('qingxin.games.cloud-walk')!).schema).toBe(2);
		expect(loaded.biomes).toEqual(expect.arrayContaining(['garden', 'water', 'underworld']));
		expect(loaded.y).toBeLessThan(-6);
	});

	it('ignores a foreign schema instead of wiping other keys', () => {
		const storage = memory({
			'qingxin.theme': 'dark',
			'qingxin.games.cloud-walk': JSON.stringify({ schema: 99, skyMode: 'night' })
		});
		const loaded = readSkySave(storage);
		expect(loaded.recovered).toBe(true);
		expect(loaded.skyMode).toBe('dawn');
		expect(storage.getItem('qingxin.theme')).toBe('dark');
	});
});

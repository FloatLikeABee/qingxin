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
		expect(loaded.visited.includes(1) || loaded.island >= 1).toBe(true);
		expect(loaded.lowDetail).toBe(true);
		expect(loaded.audioWanted).toBe(true);
		expect(loaded.dockCollapsed).toBe(true);
		expect(CLOUD_SCHEMA).toBe(1);
		expect(CLOUD_SAVE_KEY).toBe('qingxin.games.cloud-walk');
	});

	it('recovers a corrupt save without throwing', () => {
		const storage = memory({ 'qingxin.games.cloud-walk': '{nope' });
		const loaded = readSkySave(storage);
		expect(loaded.recovered).toBe(true);
		expect(loaded.garden).toHaveLength(0);
		expect(loaded.notice).toMatch(/从头/);
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

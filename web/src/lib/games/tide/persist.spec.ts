import { describe, expect, it } from 'vitest';
import { createTide, holdTide, stepTide, steerTide } from './sim';
import { TIDE_SAVE_KEY, TIDE_SCHEMA, readTideSave, writeTideSave } from './persist';

function memory(initial?: Record<string, string>) {
	const data = new Map<string, string>(Object.entries(initial ?? {}));
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => {
			data.set(key, value);
		}
	};
}

describe('tide-breath save', () => {
	it('round-trips collected starlight, coral, and settings', () => {
		const storage = memory();
		const world = createTide();
		const jelly = world.creatures.find((c) => c.kind === 'jelly')!;
		world.selected = jelly.id;
		const star = world.stars[0]!;
		steerTide(world, star.x, star.z);
		holdTide(world, true);
		for (let i = 0; i < 80; i++) stepTide(world, 100);
		world.lowDetail = true;
		world.audioWanted = true;
		world.dockCollapsed = true;
		writeTideSave(world, storage);
		const loaded = readTideSave(storage);
		expect(loaded.recovered).toBe(false);
		expect(loaded.collected).toBeGreaterThanOrEqual(1);
		expect(loaded.stars.some((s) => s.collected)).toBe(true);
		expect(loaded.coral.some((c) => c.unlocked)).toBe(true);
		expect(loaded.lowDetail).toBe(true);
		expect(loaded.audioWanted).toBe(true);
		expect(loaded.dockCollapsed).toBe(true);
		expect(TIDE_SCHEMA).toBe(1);
		expect(TIDE_SAVE_KEY).toBe('qingxin.games.tide-breath');
	});

	it('recovers a corrupt save without throwing', () => {
		const storage = memory({ 'qingxin.games.tide-breath': '{nope' });
		const loaded = readTideSave(storage);
		expect(loaded.recovered).toBe(true);
		expect(loaded.collected).toBe(0);
		expect(loaded.notice).toMatch(/重新/);
	});

	it('ignores a foreign schema instead of wiping other keys', () => {
		const storage = memory({
			'qingxin.theme': 'dark',
			'qingxin.games.tide-breath': JSON.stringify({ schema: 99, collected: 6 })
		});
		const loaded = readTideSave(storage);
		expect(loaded.recovered).toBe(true);
		expect(storage.getItem('qingxin.theme')).toBe('dark');
	});
});

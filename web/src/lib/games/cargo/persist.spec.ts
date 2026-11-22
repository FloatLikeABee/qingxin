import { describe, expect, it } from 'vitest';
import { HAUL_SAVE_KEY, HAUL_SCHEMA, readHaulSave, writeHaulSave } from './persist';
import { createHaul, setHaulControl, stepHaul } from './sim';

function memory(initial?: Record<string, string>) {
	const data = new Map<string, string>(Object.entries(initial ?? {}));
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => {
			data.set(key, value);
		}
	};
}

describe('cargo-haul save', () => {
	it('round-trips odometer, pose, and settings without wiping other keys', () => {
		const storage = memory({
			'qingxin.theme': 'dark',
			'qingxin.games.memory-shelf': '{"schema":2}'
		});
		const world = createHaul(4);
		setHaulControl(world, 'throttle', 1);
		stepHaul(world, 1200);
		world.lowDetail = true;
		world.audioWanted = true;
		writeHaulSave(world, storage);
		const loaded = readHaulSave(storage);
		expect(loaded.recovered).toBe(false);
		expect(loaded.odometer).toBeGreaterThan(5);
		expect(loaded.lowDetail).toBe(true);
		expect(loaded.audioWanted).toBe(true);
		expect(HAUL_SCHEMA).toBe(2);
		expect(HAUL_SAVE_KEY).toBe('qingxin.games.cargo-haul');
		expect(storage.getItem('qingxin.theme')).toBe('dark');
		expect(storage.getItem('qingxin.games.memory-shelf')).toBe('{"schema":2}');
	});

	it('schema 1 keeps odometer and settings and respawns on the ramp', () => {
		const storage = memory({
			'qingxin.theme': 'dark',
			'qingxin.games.cloud-walk': '{"schema":2}',
			'qingxin.games.cargo-haul': JSON.stringify({
				schema: 1,
				seed: 4,
				odometer: 12345,
				x: 900,
				z: 800,
				yaw: 1.2,
				speed: 18,
				trailerYaw: 1.2,
				biome: 'city',
				cargoLog: ['depot'],
				lowDetail: true,
				audioWanted: true,
				dockCollapsed: true,
				checkpoint: { x: 900, z: 800, yaw: 1.2, trailerYaw: 1.2, biome: 'city' }
			})
		});
		const loaded = readHaulSave(storage);
		expect(loaded.recovered).toBe(true);
		expect(loaded.notice).toContain('转向修好了');
		expect(loaded.odometer).toBe(12345);
		expect(loaded.cargoLog).toEqual(['depot']);
		expect(loaded.lowDetail).toBe(true);
		expect(loaded.audioWanted).toBe(true);
		expect(loaded.dockCollapsed).toBe(true);
		expect(loaded.onRoad).toBe(true);
		expect(Math.hypot(loaded.x, loaded.z)).toBeLessThan(40);
		expect(storage.getItem('qingxin.theme')).toBe('dark');
		expect(storage.getItem('qingxin.games.cloud-walk')).toBe('{"schema":2}');
	});

	it('recovers corrupt and foreign schema without wiping theme', () => {
		const storage = memory({
			'qingxin.theme': 'light',
			'qingxin.games.cargo-haul': '{nope'
		});
		const bad = readHaulSave(storage);
		expect(bad.recovered).toBe(true);
		expect(storage.getItem('qingxin.theme')).toBe('light');
		storage.setItem('qingxin.games.cargo-haul', JSON.stringify({ schema: 99, odometer: 9 }));
		const foreign = readHaulSave(storage);
		expect(foreign.recovered).toBe(true);
		expect(storage.getItem('qingxin.theme')).toBe('light');
	});
});

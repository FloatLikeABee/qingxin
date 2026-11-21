import { describe, expect, it } from 'vitest';
import {
	createStudy,
	enterRoom,
	isShelfRestored,
	nextShelf,
	placeInRoom,
	putInSlot,
	rememberShelf,
	stepStudy,
	takeProp
} from './sim';
import { SHELF_SAVE_KEY, SHELF_SCHEMA, readShelfSave, writeShelfSave } from './persist';

function memory(initial?: Record<string, string>) {
	const data = new Map<string, string>(Object.entries(initial ?? {}));
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => {
			data.set(key, value);
		}
	};
}

function solve(world: ReturnType<typeof createStudy>) {
	rememberShelf(world, () => 0.7);
	stepStudy(world, 800);
	for (let n = 0; n < 24 && !isShelfRestored(world); n++) {
		const i = world.goal.findIndex((k, idx) => world.slots[idx] !== k);
		if (i < 0) {
			if (world.held) {
				const empty = world.slots.findIndex((s) => s == null);
				if (empty >= 0) putInSlot(world, empty);
			}
			break;
		}
		const want = world.goal[i]!;
		if (world.held !== want) takeProp(world, want);
		if (world.held === want) putInSlot(world, i);
	}
}

describe('memory-shelf save', () => {
	it('round-trips a solved shelf, unlock, and arranged collection', () => {
		const storage = memory();
		const world = createStudy();
		solve(world);
		expect(world.phase).toBe('cleared');
		nextShelf(world);
		enterRoom(world);
		placeInRoom(world, 'globe', 0.8, 0.2, 0.4);
		world.lowDetail = true;
		world.audioWanted = true;
		writeShelfSave(world, storage);
		const loaded = readShelfSave(storage);
		expect(loaded.recovered).toBe(false);
		expect(loaded.puzzle).toBe(1);
		expect(loaded.unlocked).toContain('globe');
		expect(loaded.placements.some((p) => p.kind === 'globe' && p.arranged)).toBe(true);
		expect(loaded.lowDetail).toBe(true);
		expect(loaded.audioWanted).toBe(true);
		expect(SHELF_SCHEMA).toBe(1);
		expect(SHELF_SAVE_KEY).toBe('qingxin.games.memory-shelf');
	});

	it('recovers a corrupt save without throwing', () => {
		const storage = memory({ 'qingxin.games.memory-shelf': '{nope' });
		const loaded = readShelfSave(storage);
		expect(loaded.recovered).toBe(true);
		expect(loaded.unlocked).toHaveLength(0);
		expect(loaded.notice).toMatch(/重新/);
	});

	it('ignores a foreign schema instead of wiping other keys', () => {
		const storage = memory({
			'qingxin.theme': 'dark',
			'qingxin.games.memory-shelf': JSON.stringify({ schema: 99, puzzle: 3 })
		});
		const loaded = readShelfSave(storage);
		expect(loaded.recovered).toBe(true);
		expect(loaded.puzzle).toBe(0);
		expect(storage.getItem('qingxin.theme')).toBe('dark');
	});
});

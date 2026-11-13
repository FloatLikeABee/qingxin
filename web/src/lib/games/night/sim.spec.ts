import { describe, expect, it } from 'vitest';
import { COLS, ROWS, createNight, gust, isComplete, placeShard } from './sim';

describe('夜窗拼图 simulation', () => {
	it('builds a 4 by 3 window of unique shards', () => {
		const night = createNight({ seed: 11 });
		expect(night.cells).toHaveLength(COLS * ROWS);
		expect(new Set(night.cells.map((cell) => cell.motif)).size).toBeGreaterThanOrEqual(6);
		expect(night.tray).toHaveLength(12);
		expect(night.tray.map((piece) => piece.home).sort((a, b) => a - b)).toEqual([
			...Array(12).keys()
		]);
	});

	it('occupies a slot when the home shard is placed', () => {
		const night = createNight({ seed: 4 });
		const piece = night.tray[0];
		if (!piece) throw new Error('missing shard');
		expect(placeShard(night, piece.id, piece.home)).toBe(true);
		expect(night.slots[piece.home]).toBe(piece.id);
		expect(night.tray.some((item) => item.id === piece.id)).toBe(false);
	});

	it('rejects a wrong slot and counts a miss', () => {
		const night = createNight({ seed: 5 });
		const piece = night.tray[0];
		if (!piece) throw new Error('missing shard');
		const wrong = (piece.home + 1) % 12;
		expect(placeShard(night, piece.id, wrong)).toBe(false);
		expect(night.slots[wrong]).toBeNull();
		expect(night.misses).toBe(1);
		expect(night.tray.some((item) => item.id === piece.id)).toBe(true);
	});

	it('completes when every shard is home', () => {
		const night = createNight({ seed: 8 });
		for (const piece of [...night.tray]) placeShard(night, piece.id, piece.home);
		expect(isComplete(night)).toBe(true);
		expect(night.complete).toBe(true);
	});

	it('lets the wind reshuffle only unplaced shards', () => {
		const night = createNight({ seed: 9 });
		const first = night.tray[0];
		if (!first) throw new Error('missing shard');
		placeShard(night, first.id, first.home);
		const before = night.tray.map((piece) => piece.id).join(',');
		gust(night);
		expect(night.slots[first.home]).toBe(first.id);
		expect(night.tray).toHaveLength(11);
		const after = night.tray.map((piece) => piece.id).join(',');
		expect(after.split(',').sort()).toEqual(before.split(',').sort());
	});
});

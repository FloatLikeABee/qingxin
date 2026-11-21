import { describe, expect, it } from 'vitest';
import { MAX_PLACED, TRAY_SIZE } from './pieces';
import {
	canPlace,
	createWorld,
	occupancy,
	placeAt,
	previewCells,
	resetWorld,
	rotateSelected,
	selectTray,
	undoLast
} from './world';

describe('积木台 world', () => {
	it('starts with five tray pieces and no placed blocks', () => {
		const world = createWorld();
		expect(world.tray).toHaveLength(TRAY_SIZE);
		expect(world.placed).toHaveLength(0);
		expect(world.batchIndex).toBe(0);
		expect(world.tray[0]?.shape).toBe('cube');
	});

	it('consumes one tray slot on a valid place and does not refill yet', () => {
		const world = createWorld();
		const first = world.tray[0];
		expect(first).toBeTruthy();
		expect(placeAt(world, { x: 7, y: 0, z: 7 })).toBe(true);
		expect(world.placed).toHaveLength(1);
		expect(world.tray).toHaveLength(4);
		expect(world.placed[0]?.id).toBe(first?.id);
		expect(world.batchIndex).toBe(0);
	});

	it('refills exactly five pieces only after the fifth placement', () => {
		const world = createWorld();
		const firstBatch = world.tray.map((piece) => piece.id);
		for (let i = 0; i < 4; i++) {
			expect(placeAt(world, { x: i * 3, y: 0, z: 0 })).toBe(true);
			expect(world.tray).toHaveLength(4 - i);
		}
		expect(world.tray).toHaveLength(1);
		expect(placeAt(world, { x: 12, y: 0, z: 0 })).toBe(true);
		expect(world.placed).toHaveLength(5);
		expect(world.tray).toHaveLength(5);
		expect(world.batchIndex).toBe(1);
		expect(world.tray.some((piece) => firstBatch.includes(piece.id))).toBe(false);
		expect(world.notice).toMatch(/又来了五块/);
	});

	it('does not consume inventory on overlap or floating placement', () => {
		const world = createWorld();
		expect(placeAt(world, { x: 5, y: 0, z: 5 })).toBe(true);
		const tray = world.tray.length;
		expect(placeAt(world, { x: 5, y: 0, z: 5 })).toBe(false);
		expect(world.tray).toHaveLength(tray);
		expect(world.placed).toHaveLength(1);
		expect(canPlace(world, { x: 5, y: 3, z: 5 }).ok).toBe(false);
		expect(placeAt(world, { x: 5, y: 3, z: 5 })).toBe(false);
		expect(world.placed).toHaveLength(1);
		expect(occupancy(world).has('5,0,5')).toBe(true);
	});

	it('undoes a refill without losing or duplicating pieces', () => {
		const world = createWorld();
		for (let i = 0; i < 5; i++) {
			expect(placeAt(world, { x: i * 3, y: 0, z: 2 })).toBe(true);
		}
		const fifth = world.placed[4];
		const refillIds = world.tray.map((piece) => piece.id);
		expect(world.tray).toHaveLength(5);
		expect(undoLast(world)).toBe(true);
		expect(world.placed).toHaveLength(4);
		expect(world.tray).toHaveLength(1);
		expect(world.tray[0]?.id).toBe(fifth?.id);
		expect(world.batchIndex).toBe(0);
		expect(world.tray.some((piece) => refillIds.includes(piece.id))).toBe(false);
		expect(placeAt(world, { x: 12, y: 0, z: 2 })).toBe(true);
		expect(world.tray).toHaveLength(5);
		expect(world.placed).toHaveLength(5);
	});

	it('snaps a cube onto the top face of another cube', () => {
		const world = createWorld();
		expect(placeAt(world, { x: 8, y: 0, z: 8 })).toBe(true);
		expect(placeAt(world, { x: 8, y: 1, z: 8 })).toBe(true);
		expect(world.placed).toHaveLength(2);
		expect(previewCells(world, { x: 8, y: 2, z: 8 }).length).toBeGreaterThan(0);
	});

	it('rotates the selected tray piece and keeps a later undo at that rotation', () => {
		const world = createWorld();
		selectTray(world, 1);
		expect(world.tray[1]?.shape).toBe('bar');
		rotateSelected(world, 'y');
		expect(world.tray[1]?.rotY).toBe(1);
		expect(placeAt(world, { x: 1, y: 0, z: 6 })).toBe(true);
		expect(world.placed[0]?.rotY).toBe(1);
		undoLast(world);
		expect(world.tray.at(-1)?.rotY).toBe(1);
	});

	it('stops at the documented piece cap without claiming more room', () => {
		const world = createWorld();
		let placed = 0;
		for (let z = 0; z < 16 && placed < MAX_PLACED; z++) {
			for (let x = 0; x < 16 && placed < MAX_PLACED; x++) {
				selectTray(world, 0);
				if (placeAt(world, { x, y: 0, z })) placed += 1;
			}
		}
		expect(world.placed.length).toBe(MAX_PLACED);
		expect(world.tray).toHaveLength(0);
		expect(placeAt(world, { x: 0, y: 1, z: 0 })).toBe(false);
		expect(world.notice).toMatch(/80/);
		resetWorld(world);
		expect(world.placed).toHaveLength(0);
		expect(world.tray).toHaveLength(5);
	});
});

import { describe, expect, it } from 'vitest';
import {
	CELL,
	COLORS,
	GRID_X,
	GRID_Y,
	GRID_Z,
	MAX_PLACED,
	SHAPES,
	TRAY_SIZE,
	cellKey,
	inBounds,
	makeBatch,
	shapeById,
	worldCells,
	type Cell
} from './pieces';

function keys(cells: Cell[]) {
	return cells.map(cellKey).sort();
}

describe('积木台 pieces', () => {
	it('keeps every shape inside a 2×2×2 envelope', () => {
		expect(Object.keys(SHAPES).sort()).toEqual(
			['bar', 'cube', 'ell', 'pillar', 'plate', 'stair'].sort()
		);
		for (const shape of Object.values(SHAPES)) {
			expect(shape.cells.length).toBeGreaterThan(0);
			expect(shape.cells.length).toBeLessThanOrEqual(4);
			for (const cell of shape.cells) {
				expect(cell.x).toBeGreaterThanOrEqual(0);
				expect(cell.y).toBeGreaterThanOrEqual(0);
				expect(cell.z).toBeGreaterThanOrEqual(0);
				expect(cell.x).toBeLessThan(2);
				expect(cell.y).toBeLessThan(2);
				expect(cell.z).toBeLessThan(2);
			}
		}
		expect(shapeById('cube')?.name).toBe('方块');
		expect(TRAY_SIZE).toBe(5);
		expect(MAX_PLACED).toBe(80);
		expect(GRID_X).toBe(16);
		expect(GRID_Z).toBe(16);
		expect(GRID_Y).toBe(12);
		expect(CELL).toBeLessThan(0.5);
		expect(COLORS).toEqual(['blue', 'sky', 'coral', 'teal', 'gold']);
	});

	it('rotates a bar from X onto Z and a pillar onto the ground plane', () => {
		const bar = worldCells({
			shape: 'bar',
			origin: { x: 0, y: 0, z: 0 },
			rotY: 1,
			rotX: 0
		});
		expect(keys(bar)).toEqual(
			keys([
				{ x: 0, y: 0, z: 0 },
				{ x: 0, y: 0, z: 1 }
			])
		);
		const pillar = worldCells({
			shape: 'pillar',
			origin: { x: 3, y: 0, z: 4 },
			rotY: 0,
			rotX: 1
		});
		expect(pillar.every((cell) => cell.y >= 0)).toBe(true);
		expect(pillar.some((cell) => cell.y === 0)).toBe(true);
	});

	it('always includes a cube in a five-piece batch', () => {
		for (let batch = 0; batch < 8; batch++) {
			const next = { n: batch * 10 };
			const tray = makeBatch(batch, next);
			expect(tray).toHaveLength(5);
			expect(tray.some((piece) => piece.shape === 'cube')).toBe(true);
			expect(new Set(tray.map((piece) => piece.id)).size).toBe(5);
			expect(tray.every((piece) => COLORS.includes(piece.color))).toBe(true);
		}
	});

	it('rejects cells outside the documented table', () => {
		expect(inBounds({ x: 0, y: 0, z: 0 })).toBe(true);
		expect(inBounds({ x: 15, y: 11, z: 15 })).toBe(true);
		expect(inBounds({ x: 16, y: 0, z: 0 })).toBe(false);
		expect(inBounds({ x: 0, y: 12, z: 0 })).toBe(false);
		expect(inBounds({ x: -1, y: 0, z: 0 })).toBe(false);
	});
});

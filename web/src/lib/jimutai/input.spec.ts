import { describe, expect, it } from 'vitest';
import { CELL } from './pieces';
import {
	TAP_PX,
	cellCenter,
	classifyGesture,
	originFromGround,
	originFromPieceFace,
	worldToCell
} from './input';

describe('积木台 input', () => {
	it('treats small movement as a tap and larger movement as orbit', () => {
		expect(TAP_PX).toBe(10);
		expect(classifyGesture({ dx: 3, dy: -2, pointers: 1, shift: false, button: 0 })).toBe('tap');
		expect(classifyGesture({ dx: 24, dy: 0, pointers: 1, shift: false, button: 0 })).toBe('orbit');
		expect(classifyGesture({ dx: 24, dy: 0, pointers: 1, shift: true, button: 0 })).toBe('pan');
		expect(classifyGesture({ dx: 8, dy: 8, pointers: 2, shift: false, button: 0 })).toBe('pinch');
		expect(classifyGesture({ dx: 12, dy: 0, pointers: 1, shift: false, button: 2 })).toBe('pan');
	});

	it('maps a table hit to a ground cell and a top face to the cell above', () => {
		const center = cellCenter({ x: 7, y: 0, z: 7 });
		expect(worldToCell(center.x, center.y, center.z)).toMatchObject({ x: 7, y: 0, z: 7 });
		expect(originFromGround(center.x, center.z)).toEqual({ x: 7, y: 0, z: 7 });
		expect(originFromPieceFace({ x: 7, y: 0, z: 7 }, 'py')).toEqual({ x: 7, y: 1, z: 7 });
		expect(originFromPieceFace({ x: 7, y: 0, z: 7 }, 'px')).toEqual({ x: 8, y: 0, z: 7 });
		expect(CELL).toBeGreaterThan(0);
	});
});

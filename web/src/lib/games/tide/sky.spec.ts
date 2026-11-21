import { describe, expect, it } from 'vitest';
import { CONSTELLATIONS, TIDE_CAMERA, TIDE_MOON, skyStarCount } from './sky';

describe('tide night sky', () => {
	it('keeps the approved camera so a sky band is in frame', () => {
		expect(TIDE_CAMERA.position).toEqual([0, 5.2, 12.8]);
		expect(TIDE_CAMERA.lookAt).toEqual([0, 1.4, -1.8]);
		expect(TIDE_MOON[1]).toBeGreaterThan(3.5);
		expect(TIDE_MOON[2]).toBeLessThan(0);
		expect(TIDE_MOON[0]).toBeLessThan(-2);
	});

	it('places four named constellations in the visible sky band', () => {
		expect(CONSTELLATIONS.map((c) => c.name)).toEqual(['水母', '灯鱼', '蝠鲼', '螺']);
		for (const constellation of CONSTELLATIONS) {
			expect(constellation.points.length).toBeGreaterThanOrEqual(4);
			expect(constellation.edges.length).toBeGreaterThanOrEqual(3);
			for (const point of constellation.points) {
				expect(point[1]).toBeGreaterThan(2.4);
				expect(point[2]).toBeLessThan(4);
			}
			for (const [a, b] of constellation.edges) {
				expect(a).toBeGreaterThanOrEqual(0);
				expect(b).toBeLessThan(constellation.points.length);
				expect(a).not.toBe(b);
			}
		}
	});

	it('keeps a dense star field even in low detail', () => {
		expect(skyStarCount(false)).toBe(900);
		expect(skyStarCount(true)).toBe(400);
	});
});

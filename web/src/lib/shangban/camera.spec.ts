import { describe, expect, it } from 'vitest';
import { cameraPose, playFrustum } from './camera';
import { FLOOR_HEIGHT } from './floors';

describe('上班 camera framing', () => {
	it('uses a tighter play frustum than overview so the current floor fills the view', () => {
		expect(playFrustum(false, 800)).toBeLessThan(6.5);
		expect(playFrustum(false, 800)).toBeLessThan(playFrustum(true, 800));
		expect(playFrustum(true, 800)).toBeGreaterThan(10);
	});

	it('looks at the current floor height in play mode', () => {
		const floorY = FLOOR_HEIGHT * 2;
		const play = cameraPose(false, floorY, Math.PI * 0.28);
		const overview = cameraPose(true, floorY, Math.PI * 0.28);
		expect(play.lookY).toBeCloseTo(floorY + 0.62, 5);
		expect(overview.lookY).toBeGreaterThan(play.lookY);
		expect(play.y - floorY).toBeLessThan(overview.y - floorY);
	});
});

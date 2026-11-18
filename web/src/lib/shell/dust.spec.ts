import { describe, expect, it } from 'vitest';
import {
	DUST_CLOUDS,
	DUST_FPS,
	DUST_MOTES,
	DUST_MOTES_NARROW,
	createDustField,
	shouldAnimateDust,
	stepDust
} from './dust';

describe('space dust field', () => {
	it('starts with a bounded mote and cloud count', () => {
		const wide = createDustField(1, 1280, 800);
		expect(wide.motes).toHaveLength(DUST_MOTES);
		expect(wide.clouds).toHaveLength(DUST_CLOUDS);
		expect(DUST_MOTES).toBe(36);
		expect(DUST_MOTES_NARROW).toBe(24);
		expect(DUST_CLOUDS).toBe(4);
		expect(DUST_FPS).toBe(24);
		const narrow = createDustField(1, 390, 844);
		expect(narrow.motes).toHaveLength(DUST_MOTES_NARROW);
	});

	it('drifts motes outward from their cluster and keeps them on the board', () => {
		const field = createDustField(7, 800, 600);
		const before = field.motes.map((mote) => ({
			x: mote.x,
			y: mote.y,
			d: Math.hypot(mote.x - mote.originX, mote.y - mote.originY)
		}));
		const next = stepDust(field, 800, { reducedMotion: false });
		let movedOut = 0;
		for (let i = 0; i < next.motes.length; i++) {
			const mote = next.motes[i]!;
			expect(mote.x).toBeGreaterThanOrEqual(-40);
			expect(mote.y).toBeGreaterThanOrEqual(-40);
			expect(mote.x).toBeLessThanOrEqual(840);
			expect(mote.y).toBeLessThanOrEqual(640);
			const d = Math.hypot(mote.x - mote.originX, mote.y - mote.originY);
			if (d + 0.01 >= before[i]!.d) movedOut += 1;
		}
		expect(movedOut).toBeGreaterThan(next.motes.length / 2);
	});

	it('does not animate when hidden, playing, or reduced-motion', () => {
		expect(shouldAnimateDust({ hidden: true, playView: false, reducedMotion: false })).toBe(false);
		expect(shouldAnimateDust({ hidden: false, playView: true, reducedMotion: false })).toBe(false);
		expect(shouldAnimateDust({ hidden: false, playView: false, reducedMotion: true })).toBe(false);
		expect(shouldAnimateDust({ hidden: false, playView: false, reducedMotion: false })).toBe(true);
	});

	it('keeps the field identical under reduced motion', () => {
		const field = createDustField(3, 640, 480);
		const copy = structuredClone(field);
		const next = stepDust(field, 1000, { reducedMotion: true });
		expect(next.motes).toEqual(copy.motes);
		expect(next.clouds).toEqual(copy.clouds);
	});
});

import { describe, expect, it } from 'vitest';
import {
	DUST_FPS,
	DUST_LIGHTS,
	DUST_MOTES,
	DUST_MOTES_NARROW,
	DUST_STARS_FAR,
	DUST_STARS_FAR_NARROW,
	DUST_STARS_NEAR,
	DUST_STARS_NEAR_NARROW,
	DUST_WAVES,
	createDustField,
	shouldAnimateDust,
	stepDust,
	waveY
} from './dust';

describe('nebula wave field', () => {
	it('starts with layered waves, two star depths, lights, and a bounded mote count', () => {
		const wide = createDustField(1, 1280, 800);
		expect(wide.waves).toHaveLength(DUST_WAVES);
		expect(DUST_WAVES).toBeGreaterThanOrEqual(2);
		expect(wide.starsFar).toHaveLength(DUST_STARS_FAR);
		expect(wide.starsNear).toHaveLength(DUST_STARS_NEAR);
		expect(wide.lights).toHaveLength(DUST_LIGHTS);
		expect(wide.motes).toHaveLength(DUST_MOTES);
		expect(DUST_MOTES).toBe(36);
		expect(DUST_MOTES_NARROW).toBe(24);
		expect(DUST_STARS_FAR_NARROW).toBeLessThan(DUST_STARS_FAR);
		expect(DUST_STARS_NEAR_NARROW).toBeLessThan(DUST_STARS_NEAR);
		expect(DUST_FPS).toBe(24);
		expect(wide.waves.some((wave) => wave.tint === 'violet')).toBe(true);
		expect(wide.waves.some((wave) => wave.tint === 'blue')).toBe(true);
		const narrow = createDustField(1, 390, 844);
		expect(narrow.motes).toHaveLength(DUST_MOTES_NARROW);
		expect(narrow.starsFar).toHaveLength(DUST_STARS_FAR_NARROW);
		expect(narrow.starsNear).toHaveLength(DUST_STARS_NEAR_NARROW);
	});

	it('drifts waves slowly and never teleports a wave in one 16ms step', () => {
		const field = createDustField(7, 800, 600);
		const next = stepDust(field, 16, { reducedMotion: false });
		for (let i = 0; i < next.waves.length; i++) {
			expect(Math.abs(next.waves[i]!.phase - field.waves[i]!.phase)).toBeLessThan(0.05);
			expect(next.waves[i]!.phase).not.toBe(field.waves[i]!.phase);
		}
		const later = stepDust(field, 800, { reducedMotion: false });
		expect(
			Math.abs(waveY(later.waves[0]!, 200, 600) - waveY(field.waves[0]!, 200, 600))
		).toBeGreaterThan(0.2);
	});

	it('moves particles along the wave instead of exploding from a cluster', () => {
		const field = createDustField(9, 800, 600);
		const next = stepDust(field, 40, { reducedMotion: false });
		let along = 0;
		for (let i = 0; i < next.motes.length; i++) {
			const before = field.motes[i]!;
			const after = next.motes[i]!;
			expect(after.x).toBeGreaterThanOrEqual(-48);
			expect(after.x).toBeLessThanOrEqual(848);
			if (after.x + 0.01 >= before.x) along += 1;
		}
		expect(along).toBeGreaterThan(next.motes.length / 2);
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
		expect(next).toEqual(copy);
	});

	it('caps a catch-up dt so a hidden-tab return cannot burst the phase', () => {
		const field = createDustField(4, 800, 600);
		const modest = stepDust(field, 48, { reducedMotion: false });
		const burst = stepDust(field, 8000, { reducedMotion: false });
		expect(Math.abs(burst.waves[0]!.phase - modest.waves[0]!.phase)).toBeLessThan(0.0001);
	});
});

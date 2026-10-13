import { describe, expect, it } from 'vitest';
import { breathePhase, breatheScale, CYCLE_SECONDS } from './breathe';

describe('breathePhase', () => {
	it('maps 4-7-8 offsets to inhale, hold, and exhale', () => {
		expect(breathePhase(0).id).toBe('inhale');
		expect(breathePhase(4).id).toBe('hold');
		expect(breathePhase(11).id).toBe('exhale');
	});

	it('wraps after one 19-second cycle', () => {
		expect(CYCLE_SECONDS).toBe(19);
		expect(breathePhase(19).id).toBe('inhale');
	});

	it('freezes the orb scale when motion is reduced', () => {
		const inhale = breathePhase(2);
		const hold = breathePhase(6);
		expect(breatheScale(inhale, true)).toBe(1);
		expect(breatheScale(hold, true)).toBe(1);
		expect(breatheScale(inhale, false)).not.toBe(1);
	});
});

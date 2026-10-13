import { describe, expect, it } from 'vitest';
import { breathePhase, CYCLE_SECONDS } from './breathe';

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
});

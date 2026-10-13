import { describe, expect, it } from 'vitest';
import { applyGrade, shiftDay } from './review';

describe('SM-2-lite', () => {
	it('advances interval past 1 after a good grade at interval 1', () => {
		const next = applyGrade({ ease: 2.5, intervalDays: 1 }, 'good');
		expect(next.intervalDays).toBe(6);
		expect(shiftDay('2026-10-13', next.intervalDays)).toBe('2026-10-19');
	});
});

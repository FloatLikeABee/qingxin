import { describe, expect, it } from 'vitest';
import { currentStreak } from './streak';

describe('currentStreak', () => {
	it('counts consecutive days ending today', () => {
		expect(currentStreak(['2026-10-11', '2026-10-12', '2026-10-13'], '2026-10-13')).toBe(3);
	});

	it('treats a same-day duplicate as one day', () => {
		expect(currentStreak(['2026-10-13', '2026-10-13'], '2026-10-13')).toBe(1);
	});

	it('resets after a gap', () => {
		expect(currentStreak(['2026-10-10', '2026-10-13'], '2026-10-13')).toBe(1);
	});
});

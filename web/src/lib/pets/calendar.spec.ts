import { describe, expect, it } from 'vitest';
import { calendarMarks, monthGrid } from './calendar';
import type { PetRecord, PetWeight } from './types';

describe('pets calendar', () => {
	it('builds a 6-week grid for October 2026 starting on Thursday', () => {
		const days = monthGrid('2026-10');
		expect(days).toHaveLength(42);
		expect(days[3]?.date).toBe('2026-10-01');
		expect(days[33]?.date).toBe('2026-10-31');
	});

	it('marks due records and weigh-ins on the month view', () => {
		const records: PetRecord[] = [
			{
				id: 'r1',
				petId: 'p1',
				type: 'vaccine',
				date: '2026-10-08',
				nextDueDate: '2026-10-20',
				note: null,
				createdAt: '2026-10-08T00:00:00Z',
				updatedAt: '2026-10-08T00:00:00Z',
				disclaimer: '非兽医建议'
			}
		];
		const weights: PetWeight[] = [
			{
				id: 'w1',
				petId: 'p1',
				measuredOn: '2026-10-13',
				weightG: 4200,
				createdAt: '2026-10-13T00:00:00Z'
			}
		];
		const marks = calendarMarks('2026-10', records, weights);
		expect(marks['2026-10-08']).toContain('vaccine');
		expect(marks['2026-10-20']).toContain('due');
		expect(marks['2026-10-13']).toContain('weight');
	});
});

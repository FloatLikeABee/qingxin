import { describe, expect, it } from 'vitest';
import { APPLICATION_STATUSES, moveApplication, statusTone } from './status';
import type { Application } from './funnel';

describe('kanban status', () => {
	it('exposes the three board columns', () => {
		expect(APPLICATION_STATUSES).toEqual(['投递', '面试', 'Offer']);
	});

	it('moves a card to Offer and tags it with the highlight tone', () => {
		const apps: Application[] = [
			{ id: '1', company: '轻心实验室', position: '前端', status: '投递' }
		];
		const next = moveApplication(apps, '1', 'Offer');
		expect(next[0]?.status).toBe('Offer');
		expect(statusTone('Offer')).toBe('offer');
		expect(statusTone('面试')).toBe('interview');
		expect(statusTone('投递')).toBe('applied');
	});

	it('rejects an unknown status', () => {
		const apps: Application[] = [
			{ id: '1', company: '轻心实验室', position: '前端', status: '投递' }
		];
		expect(() => moveApplication(apps, '1', '归档')).toThrow(/invalid/);
	});
});

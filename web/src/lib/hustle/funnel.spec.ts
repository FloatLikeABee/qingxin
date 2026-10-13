import { describe, expect, it } from 'vitest';
import { funnelStages, type Application } from './funnel';

describe('funnelStages', () => {
	it('counts 投递 / 面试 / Offer including zeros', () => {
		const apps: Application[] = [
			{ id: '1', company: 'A', position: '前端', status: '投递' },
			{ id: '2', company: 'B', position: '前端', status: '投递' },
			{ id: '3', company: 'C', position: '产品', status: '面试' }
		];
		expect(funnelStages(apps)).toEqual([
			{ status: '投递', count: 2 },
			{ status: '面试', count: 1 },
			{ status: 'Offer', count: 0 }
		]);
	});
});

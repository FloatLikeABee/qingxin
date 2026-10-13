import { describe, expect, it } from 'vitest';
import { filterTemplates, INSPIRATION, PLATFORMS, TEMPLATES } from './catalog';

describe('create catalogs', () => {
	it('lists four platforms and at least one template each', () => {
		expect([...PLATFORMS]).toEqual(['小红书', '公众号', '抖音', '周报']);
		for (const platform of PLATFORMS) {
			expect(TEMPLATES.some((item) => item.platform === platform)).toBe(true);
		}
		expect(INSPIRATION.length).toBeGreaterThanOrEqual(4);
	});

	it('filters templates by platform', () => {
		const xhs = filterTemplates(TEMPLATES, '小红书');
		expect(xhs.length).toBeGreaterThan(0);
		expect(xhs.every((item) => item.platform === '小红书')).toBe(true);
	});
});

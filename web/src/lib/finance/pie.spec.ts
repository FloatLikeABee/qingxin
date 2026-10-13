import { describe, expect, it } from 'vitest';
import { pieSlicePath } from './pie';

describe('pieSlicePath', () => {
	it('draws two semicircles for a 100 percent slice', () => {
		const d = pieSlicePath(-Math.PI / 2, Math.PI * 2);
		expect(d).toContain('A 40 40 0 1 1');
		expect(d.split('A ').length - 1).toBe(2);
	});

	it('draws a wedge for a half slice', () => {
		const d = pieSlicePath(-Math.PI / 2, Math.PI);
		expect(d.startsWith('M 50 50 L ')).toBe(true);
		expect(d).toContain('A 40 40 0 0 1');
	});
});

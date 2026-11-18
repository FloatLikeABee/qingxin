import { describe, expect, it } from 'vitest';
import { topbarOffsetPx } from './topbar';

describe('topbar offset', () => {
	it('clears reserve on play views and missing measurements', () => {
		expect(topbarOffsetPx(true, 88)).toBe('0px');
		expect(topbarOffsetPx(false, null)).toBe('0px');
		expect(topbarOffsetPx(false, undefined)).toBe('0px');
		expect(topbarOffsetPx(false, Number.NaN)).toBe('0px');
	});

	it('ceils the header bottom so in-flow content clears the bar', () => {
		expect(topbarOffsetPx(false, 72.2)).toBe('73px');
		expect(topbarOffsetPx(false, 0)).toBe('0px');
		expect(topbarOffsetPx(false, -4)).toBe('0px');
	});
});

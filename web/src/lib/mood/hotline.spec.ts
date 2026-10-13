import { describe, expect, it } from 'vitest';
import { HOTLINE_NUMBER, hotlineHref } from './hotline';

describe('hotline', () => {
	it('dials 12356 only via tel:', () => {
		expect(HOTLINE_NUMBER).toBe('12356');
		expect(hotlineHref()).toBe('tel:12356');
	});
});

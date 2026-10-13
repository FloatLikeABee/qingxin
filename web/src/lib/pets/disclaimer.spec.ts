import { describe, expect, it } from 'vitest';
import { DISCLAIMER, LOCAL_LIFE_HREF } from './disclaimer';

describe('pets disclaimer', () => {
	it('uses the 非兽医建议 notice on every health view', () => {
		expect(DISCLAIMER).toContain('非兽医建议');
	});

	it('points nearby services at the M4 local-life placeholder', () => {
		expect(LOCAL_LIFE_HREF).toBe('/modules/local?category=pet');
	});
});

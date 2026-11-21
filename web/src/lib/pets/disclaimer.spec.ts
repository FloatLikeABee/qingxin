import { describe, expect, it } from 'vitest';
import { DISCLAIMER, LOCAL_LIFE_HREF } from './disclaimer';

describe('pets disclaimer', () => {
	it('uses the 非兽医建议 notice on every health view', () => {
		expect(DISCLAIMER).toContain('非兽医建议');
	});

	it('does not send nearby services to the retired local-life map', () => {
		expect(LOCAL_LIFE_HREF).toBe('/pets');
		expect(LOCAL_LIFE_HREF).not.toContain('/modules/local');
	});
});

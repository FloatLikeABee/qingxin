import { describe, expect, it } from 'vitest';
import { RETIRED_MODULES, isRetiredSlug, retiredBySlug } from './catalog';

describe('retired modules', () => {
	it('names the four withdrawn modules and their old routes', () => {
		expect(RETIRED_MODULES.map((item) => item.slug).sort()).toEqual(
			['ai', 'hustle', 'local', 'study'].sort()
		);
		expect(retiredBySlug('local')?.name).toBe('本地生活');
		expect(retiredBySlug('ai')?.name).toBe('AI效率工具箱');
		expect(retiredBySlug('study')?.name).toBe('学习打卡');
		expect(retiredBySlug('hustle')?.name).toBe('求职副业');
		expect(isRetiredSlug('local')).toBe(true);
		expect(isRetiredSlug('shangban')).toBe(false);
		expect(retiredBySlug('study')?.aliases).toContain('/study');
	});
});

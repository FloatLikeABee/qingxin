import { describe, expect, it } from 'vitest';
import { getModule, MODULES } from './modules';

describe('module catalog', () => {
	it('includes 秘密 and lists 上班 instead of 内容创作', () => {
		expect(MODULES.some((item) => item.slug === 'shangban' && item.name === '上班')).toBe(true);
		expect(MODULES.some((item) => item.slug === 'create' || item.name === '内容创作')).toBe(false);
		expect(getModule('secrets')).toMatchObject({
			slug: 'secrets',
			name: '秘密'
		});
		expect(MODULES.some((item) => item.slug === 'kit')).toBe(false);
	});

	it('lists 游戏 as a real module and still omits 组件', () => {
		expect(getModule('games')).toMatchObject({
			slug: 'games',
			name: '游戏'
		});
		expect(MODULES.some((item) => item.slug === 'kit' || item.name === '组件')).toBe(false);
	});
});

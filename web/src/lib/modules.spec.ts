import { describe, expect, it } from 'vitest';
import { getModule, MODULES } from './modules';

describe('module catalog', () => {
	it('includes 秘密 and keeps 内容创作 as a first-class module', () => {
		expect(MODULES.some((item) => item.slug === 'create' && item.name === '内容创作')).toBe(true);
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

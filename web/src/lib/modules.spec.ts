import { describe, expect, it } from 'vitest';
import { getModule, MODULES } from './modules';

describe('module catalog', () => {
	it('includes 秘密 and keeps 上班 out of the top-level module list', () => {
		expect(MODULES.some((item) => item.slug === 'shangban')).toBe(false);
		expect(MODULES.some((item) => item.name === '上班')).toBe(false);
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

	it('lists 积木台 and hides the four retired modules', () => {
		expect(getModule('jimutai')).toMatchObject({
			slug: 'jimutai',
			name: '积木台'
		});
		expect(MODULES.some((item) => ['local', 'ai', 'study', 'hustle'].includes(item.slug))).toBe(
			false
		);
		expect(MODULES.some((item) => item.name === '本地生活')).toBe(false);
		expect(MODULES.some((item) => item.name === 'AI效率工具箱')).toBe(false);
		expect(MODULES.some((item) => item.name === '学习打卡')).toBe(false);
		expect(MODULES.some((item) => item.name === '求职副业')).toBe(false);
	});
});

import { describe, expect, it } from 'vitest';
import { isTabActive, TABS } from './nav';

describe('primary nav', () => {
	it('keeps four zh-CN destinations and replaces 内容 with 上班', () => {
		expect(TABS).toHaveLength(4);
		expect(TABS.map((tab) => tab.label)).toEqual(['首页', '上班', '模块', '我的']);
		expect(TABS.map((tab) => tab.href)).toEqual([
			'/',
			'/modules/shangban',
			'/modules',
			'/settings'
		]);
		expect(TABS.some((tab) => tab.label === '组件' || tab.href === '/kit')).toBe(false);
		expect(TABS.some((tab) => tab.label === '内容')).toBe(false);
	});

	it('marks 上班 play as the 上班 tab, not 模块', () => {
		expect(isTabActive('/modules/shangban', '/modules/shangban')).toBe(true);
		expect(isTabActive('/modules', '/modules/shangban')).toBe(false);
		expect(isTabActive('/modules/shangban', '/modules')).toBe(false);
		expect(isTabActive('/modules/mood', '/modules')).toBe(true);
		expect(isTabActive('/modules/games', '/modules')).toBe(true);
		expect(isTabActive('/modules/games/convenient-store/play', '/modules')).toBe(true);
		expect(isTabActive('/', '/')).toBe(true);
		expect(isTabActive('/settings/extra', '/settings')).toBe(true);
	});
});

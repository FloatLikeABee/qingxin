import { describe, expect, it } from 'vitest';
import { isTabActive, TABS } from './nav';

describe('primary nav', () => {
	it('keeps four zh-CN destinations and replaces 组件 with 内容', () => {
		expect(TABS).toHaveLength(4);
		expect(TABS.map((tab) => tab.label)).toEqual(['首页', '内容', '模块', '我的']);
		expect(TABS.map((tab) => tab.href)).toEqual(['/', '/modules/create', '/modules', '/settings']);
		expect(TABS.some((tab) => tab.label === '组件' || tab.href === '/kit')).toBe(false);
	});

	it('marks nested content routes as the 内容 tab', () => {
		expect(isTabActive('/modules/create', '/modules/create')).toBe(true);
		expect(isTabActive('/modules', '/modules/create')).toBe(false);
		expect(isTabActive('/modules/create', '/modules')).toBe(false);
		expect(isTabActive('/modules/mood', '/modules')).toBe(true);
		expect(isTabActive('/', '/')).toBe(true);
		expect(isTabActive('/settings/extra', '/settings')).toBe(true);
	});
});

import { describe, expect, it } from 'vitest';
import { isTopbarActive, TOPBAR } from './nav';

describe('primary nav', () => {
	it('keeps three board top-bar destinations and leaves kit off chrome', () => {
		expect(TOPBAR).toHaveLength(3);
		expect(TOPBAR.map((tab) => tab.label)).toEqual(['首页', '模块中心', '我的']);
		expect(TOPBAR.map((tab) => tab.href)).toEqual(['/', '/modules', '/settings']);
		expect(TOPBAR.some((tab) => tab.label === '组件' || tab.href === '/kit')).toBe(false);
		expect(TOPBAR.some((tab) => tab.label === '内容' || tab.label === '上班')).toBe(false);
	});

	it('marks module routes on 模块中心 and leaves 上班 off the top bar', () => {
		expect(isTopbarActive('/modules', '/modules')).toBe(true);
		expect(isTopbarActive('/modules/mood', '/modules')).toBe(true);
		expect(isTopbarActive('/modules/games', '/modules')).toBe(true);
		expect(isTopbarActive('/modules/jimutai', '/modules')).toBe(true);
		expect(isTopbarActive('/modules/shangban', '/modules')).toBe(true);
		expect(isTopbarActive('/modules/shangban', '/')).toBe(false);
		expect(isTopbarActive('/modules/games/convenient-store/play', '/modules')).toBe(true);
		expect(isTopbarActive('/', '/')).toBe(true);
		expect(isTopbarActive('/settings/extra', '/settings')).toBe(true);
		expect(isTopbarActive('/kit', '/settings')).toBe(true);
	});
});

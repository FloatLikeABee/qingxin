export const TABS = [
	{ href: '/', label: '首页', icon: 'home' },
	{ href: '/modules', label: '模块', icon: 'grid' },
	{ href: '/kit', label: '组件', icon: 'kit' },
	{ href: '/settings', label: '我的', icon: 'user' }
] as const;

export function isTabActive(pathname: string, href: string): boolean {
	if (href === '/') return pathname === '/';
	return pathname === href || pathname.startsWith(`${href}/`);
}

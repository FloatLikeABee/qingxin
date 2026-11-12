export const TABS = [
	{ href: '/', label: '首页', icon: 'home' },
	{ href: '/modules/create', label: '内容', icon: 'pen' },
	{ href: '/modules', label: '模块', icon: 'grid' },
	{ href: '/settings', label: '我的', icon: 'user' }
] as const;

export function isTabActive(pathname: string, href: string): boolean {
	if (href === '/') return pathname === '/';
	if (href === '/modules/create') {
		return pathname === href || pathname.startsWith(`${href}/`);
	}
	if (href === '/modules') {
		if (pathname === '/modules' || pathname === '/modules/') return true;
		if (pathname.startsWith('/modules/create')) return false;
		return pathname.startsWith('/modules/');
	}
	return pathname === href || pathname.startsWith(`${href}/`);
}

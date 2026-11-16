export const TABS = [
	{ href: '/', label: '首页', icon: 'home' },
	{ href: '/modules/shangban', label: '上班', icon: 'briefcase' },
	{ href: '/modules', label: '模块', icon: 'grid' },
	{ href: '/settings', label: '我的', icon: 'user' }
] as const;

export function isTabActive(pathname: string, href: string): boolean {
	if (href === '/') return pathname === '/';
	if (href === '/modules/shangban') {
		return pathname === href || pathname.startsWith(`${href}/`);
	}
	if (href === '/modules') {
		if (pathname === '/modules' || pathname === '/modules/') return true;
		if (pathname.startsWith('/modules/shangban')) return false;
		if (pathname.startsWith('/modules/create')) return true;
		return pathname.startsWith('/modules/');
	}
	return pathname === href || pathname.startsWith(`${href}/`);
}

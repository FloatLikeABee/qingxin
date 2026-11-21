export const TOPBAR = [
	{ href: '/', label: '首页', icon: 'home' },
	{ href: '/modules', label: '模块中心', icon: 'grid' },
	{ href: '/settings', label: '我的', icon: 'user' }
] as const;

export function isPlayView(pathname: string) {
	return (
		/\/play\/?$/.test(pathname) ||
		pathname.startsWith('/modules/shangban') ||
		pathname.startsWith('/modules/jimutai')
	);
}

export function isTopbarActive(pathname: string, href: string): boolean {
	if (href === '/') return pathname === '/';
	if (href === '/modules') {
		return pathname === '/modules' || pathname.startsWith('/modules/');
	}
	if (href === '/settings') {
		return (
			pathname === href ||
			pathname.startsWith(`${href}/`) ||
			pathname === '/kit' ||
			pathname.startsWith('/kit/') ||
			pathname === '/privacy' ||
			pathname === '/offline'
		);
	}
	return pathname === href || pathname.startsWith(`${href}/`);
}

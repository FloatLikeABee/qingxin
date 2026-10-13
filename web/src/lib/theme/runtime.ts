import {
	applyAppearance,
	parseThemeMode,
	resolveAppearance,
	THEME_STORAGE_KEY,
	type ThemeMode
} from './resolve';

export function readStoredMode(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): ThemeMode {
	try {
		return parseThemeMode(storage?.getItem(THEME_STORAGE_KEY));
	} catch {
		return 'system';
	}
}

export function persistMode(mode: ThemeMode, storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage) {
	try {
		storage?.setItem(THEME_STORAGE_KEY, mode);
	} catch {
		// Ignore quota / private-mode failures; the in-memory mode still applies.
	}
}

export function syncDocumentTheme(
	mode: ThemeMode,
	options: {
		hour?: number;
		prefersDark?: boolean;
		root?: HTMLElement;
		meta?: Element | null;
	} = {}
) {
	if (typeof document === 'undefined') return;
	const root = options.root ?? document.documentElement;
	const prefersDark =
		options.prefersDark ??
		(typeof window !== 'undefined'
			? window.matchMedia('(prefers-color-scheme: dark)').matches
			: false);
	const hour = options.hour ?? new Date().getHours();
	const appearance = resolveAppearance({ mode, prefersDark, hour });
	applyAppearance(root, appearance);
	const meta = options.meta ?? document.querySelector('meta[name="color-scheme"]');
	meta?.setAttribute('content', mode === 'system' ? 'light dark' : appearance);
	const themeColor = document.querySelector('meta[name="theme-color"]');
	themeColor?.setAttribute('content', appearance === 'dark' ? '#111827' : '#3B82F6');
}

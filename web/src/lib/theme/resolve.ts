export type ThemeMode = 'light' | 'dark' | 'system' | 'night-only';
export type Appearance = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'qingxin.theme';
export const NIGHT_ONLY_START_HOUR = 19;
export const NIGHT_ONLY_END_HOUR = 7;

export interface ThemeResolverInput {
	mode: ThemeMode;
	prefersDark: boolean;
	hour: number;
}

export const palette = {
	light: {
		primary: '#3B82F6',
		background: '#FFFFFF',
		text: '#1F2937',
		secondary: '#6B7280'
	},
	dark: {
		primary: '#60A5FA',
		background: '#111827',
		text: '#F9FAFB',
		secondary: '#9CA3AF'
	}
} as const;

export function isNightHour(hour: number): boolean {
	return hour >= NIGHT_ONLY_START_HOUR || hour < NIGHT_ONLY_END_HOUR;
}

export function resolveAppearance(input: ThemeResolverInput): Appearance {
	switch (input.mode) {
		case 'light':
			return 'light';
		case 'dark':
			return 'dark';
		case 'system':
			return input.prefersDark ? 'dark' : 'light';
		case 'night-only':
			return isNightHour(input.hour) ? 'dark' : 'light';
	}
}

export function parseThemeMode(value: string | null | undefined): ThemeMode {
	if (value === 'light' || value === 'dark' || value === 'system' || value === 'night-only') {
		return value;
	}
	return 'system';
}

export function applyAppearance(root: { classList: DOMTokenList; style: CSSStyleDeclaration }, appearance: Appearance) {
	root.classList.toggle('dark', appearance === 'dark');
	root.style.colorScheme = appearance;
}

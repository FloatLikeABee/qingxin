import type { HeroKey, LocalCategory } from './catalog';

export function heroGradient(key: HeroKey | LocalCategory | null | undefined): string {
	switch (key) {
		case 'pet':
		case '宠物':
			return 'linear-gradient(135deg, #fb7185, #f472b6)';
		case 'repair':
		case '维修':
			return 'linear-gradient(135deg, #38bdf8, #818cf8)';
		case 'delivery':
		case '配送':
			return 'linear-gradient(135deg, #34d399, #2dd4bf)';
		default:
			return 'linear-gradient(135deg, #f59e0b, #fbbf24)';
	}
}

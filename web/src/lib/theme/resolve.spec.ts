import { describe, expect, it } from 'vitest';
import { palette, resolveAppearance } from './resolve';

describe('resolveAppearance', () => {
	it('returns light when mode is light even if the OS prefers dark', () => {
		expect(
			resolveAppearance({ mode: 'light', prefersDark: true, hour: 23 })
		).toBe('light');
	});

	it('returns dark when mode is dark even at midday', () => {
		expect(
			resolveAppearance({ mode: 'dark', prefersDark: false, hour: 12 })
		).toBe('dark');
	});

	it('follows the system preference when mode is system', () => {
		expect(
			resolveAppearance({ mode: 'system', prefersDark: true, hour: 12 })
		).toBe('dark');
		expect(
			resolveAppearance({ mode: 'system', prefersDark: false, hour: 23 })
		).toBe('light');
	});

	it('uses dark for night-only at 19:00 inclusive', () => {
		expect(
			resolveAppearance({ mode: 'night-only', prefersDark: false, hour: 19 })
		).toBe('dark');
	});

	it('uses dark for night-only before 07:00', () => {
		expect(
			resolveAppearance({ mode: 'night-only', prefersDark: false, hour: 6 })
		).toBe('dark');
	});

	it('uses light for night-only at 07:00 and midday', () => {
		expect(
			resolveAppearance({ mode: 'night-only', prefersDark: true, hour: 7 })
		).toBe('light');
		expect(
			resolveAppearance({ mode: 'night-only', prefersDark: true, hour: 12 })
		).toBe('light');
	});
});

describe('palette', () => {
	it('exposes the exact light tokens from spec 1.3', () => {
		expect(palette.light).toEqual({
			primary: '#3B82F6',
			background: '#FFFFFF',
			text: '#1F2937',
			secondary: '#6B7280'
		});
	});

	it('exposes the exact dark tokens from spec 1.3', () => {
		expect(palette.dark).toEqual({
			primary: '#60A5FA',
			background: '#111827',
			text: '#F9FAFB',
			secondary: '#9CA3AF'
		});
	});
});

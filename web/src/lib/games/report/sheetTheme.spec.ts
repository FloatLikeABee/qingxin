import { describe, expect, it } from 'vitest';
import { contrastPairs, contrastRatio, fillTone, sheetStyle } from './sheetTheme';

describe('annual-report sheet contrast', () => {
	it('keeps every light and dark pair at least 4.5:1', () => {
		for (const mode of ['light', 'dark'] as const) {
			for (const pair of contrastPairs(mode)) {
				expect(contrastRatio(pair.fg, pair.bg), `${mode} ${pair.name}`).toBeGreaterThanOrEqual(4.5);
			}
		}
	});

	it('maps seed fills to themed tones instead of leaking hex into dark ink', () => {
		expect(fillTone('#dbeafe')).toBe('hl');
		expect(fillTone('#fef3c7')).toBe('warn');
		expect(fillTone(undefined)).toBe('');
		expect(sheetStyle('light')).toContain('--sheet-ink:#1c1917');
		expect(sheetStyle('dark')).toContain('--sheet-ink:#f4ebe0');
		expect(sheetStyle('dark')).not.toContain('--qx-text');
	});
});

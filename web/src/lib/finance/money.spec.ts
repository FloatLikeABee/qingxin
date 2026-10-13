import { describe, expect, it } from 'vitest';
import { displayYuan, fenFromYuanInput, formatYuan, yuanDigitsToFen } from './money';

describe('finance money', () => {
	it('converts a 3-step keypad amount 25.50 into 2550 fen', () => {
		expect(fenFromYuanInput('25.50')).toBe(2550);
		expect(yuanDigitsToFen('2550', 2)).toBe(2550);
		expect(formatYuan(2550)).toBe('25.50');
	});

	it('rejects zero and incomplete amounts', () => {
		expect(fenFromYuanInput('0')).toBeNull();
		expect(fenFromYuanInput('0.00')).toBeNull();
		expect(fenFromYuanInput('')).toBeNull();
	});

	it('keeps a trailing decimal visible while typing 25.50', () => {
		expect(displayYuan('25')).toBe('25.00');
		expect(displayYuan('25.')).toBe('25.00');
		expect(displayYuan('25.5')).toBe('25.50');
		expect(displayYuan('25.50')).toBe('25.50');
	});
});

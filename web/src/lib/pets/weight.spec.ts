import { describe, expect, it } from 'vitest';
import { formatKg, parseGrams } from './weight';

describe('pet weight helpers', () => {
	it('formats integer grams as kilograms with two decimals', () => {
		expect(formatKg(4200)).toBe('4.20 kg');
	});

	it('rejects zero and negative grams', () => {
		expect(parseGrams('0')).toBeNull();
		expect(parseGrams('-1')).toBeNull();
		expect(parseGrams('4200')).toBe(4200);
	});
});

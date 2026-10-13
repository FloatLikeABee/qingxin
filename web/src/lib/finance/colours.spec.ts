import { describe, expect, it } from 'vitest';
import { amountTone, FINANCE_TOKENS } from './colours';

describe('finance colour tokens', () => {
	it('uses red for spending and green for income', () => {
		expect(FINANCE_TOKENS.expense).toBe('#DC2626');
		expect(FINANCE_TOKENS.income).toBe('#16A34A');
		expect(FINANCE_TOKENS.expenseDark).toBe('#FB7185');
		expect(FINANCE_TOKENS.incomeDark).toBe('#34D399');
		expect(amountTone('expense')).toContain('--qx-expense');
		expect(amountTone('income')).toContain('--qx-income');
	});
});

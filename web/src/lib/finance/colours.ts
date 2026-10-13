import type { TxType } from './types';

export const FINANCE_TOKENS = {
	expense: '#DC2626',
	income: '#16A34A',
	expenseDark: '#FB7185',
	incomeDark: '#34D399'
} as const;

export function amountTone(type: TxType): string {
	return type === 'expense' ? 'text-[var(--qx-expense)]' : 'text-[var(--qx-income)]';
}

export function financeStyleVars(): string {
	return [
		`--qx-expense:${FINANCE_TOKENS.expense}`,
		`--qx-income:${FINANCE_TOKENS.income}`,
		`--qx-expense-dark:${FINANCE_TOKENS.expenseDark}`,
		`--qx-income-dark:${FINANCE_TOKENS.incomeDark}`
	].join(';');
}

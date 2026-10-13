export type TxType = 'income' | 'expense';
export type SubCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface FinanceCategory {
	id: string;
	name: string;
	kind: TxType;
	system: boolean;
}

export interface FinanceTransaction {
	id: string;
	amountFen: number;
	currency: 'CNY';
	type: TxType;
	categoryId: string;
	categoryName: string;
	note: string | null;
	occurredOn: string;
	clientId: string;
	createdAt: string;
	updatedAt: string;
}

export interface FinanceBudget {
	id: string;
	categoryId: string | null;
	categoryName: string | null;
	monthlyLimitFen: number;
	alertThresholdPct: number;
	spentFen?: number;
	pct?: number;
	alert?: boolean;
}

export interface FinanceSubscription {
	id: string;
	name: string;
	priceFen: number;
	currency: 'CNY';
	cycle: SubCycle;
	nextBillingDate: string;
	remindDaysBefore: number;
	active: boolean;
	annualCostFen: number;
}

export interface FinanceChallenge {
	id: string;
	name: string;
	targetDays: number;
	targetAmountFen: number | null;
	startDate: string;
	progressDays: number;
	checkins: string[];
}

export interface FinanceSummary {
	month: string;
	currency: 'CNY';
	incomeFen: number;
	expenseFen: number;
	balanceFen: number;
	byCategory: { categoryId: string; categoryName: string; kind: TxType; amountFen: number }[];
	budgets: FinanceBudget[];
	recent: FinanceTransaction[];
}

export const SYSTEM_CATEGORIES: FinanceCategory[] = [
	{ id: 'fin-cat-exp-food', name: '餐饮', kind: 'expense', system: true },
	{ id: 'fin-cat-exp-transit', name: '交通', kind: 'expense', system: true },
	{ id: 'fin-cat-exp-shop', name: '购物', kind: 'expense', system: true },
	{ id: 'fin-cat-exp-home', name: '居住', kind: 'expense', system: true },
	{ id: 'fin-cat-exp-fun', name: '娱乐', kind: 'expense', system: true },
	{ id: 'fin-cat-exp-med', name: '医疗', kind: 'expense', system: true },
	{ id: 'fin-cat-exp-study', name: '学习', kind: 'expense', system: true },
	{ id: 'fin-cat-exp-other', name: '其他', kind: 'expense', system: true },
	{ id: 'fin-cat-inc-salary', name: '工资', kind: 'income', system: true },
	{ id: 'fin-cat-inc-part', name: '兼职', kind: 'income', system: true },
	{ id: 'fin-cat-inc-yield', name: '理财收益', kind: 'income', system: true },
	{ id: 'fin-cat-inc-other', name: '其他', kind: 'income', system: true }
];

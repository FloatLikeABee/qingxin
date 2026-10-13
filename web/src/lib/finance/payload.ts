import { asNumber, asRecord, asString, itemsOf, omitEmpty } from '../api/wire';
import type {
	FinanceBudget,
	FinanceCategory,
	FinanceChallenge,
	FinanceSubscription,
	FinanceSummary,
	FinanceTransaction,
	SubCycle,
	TxType
} from './types';

export interface FinanceTxInput {
	amountFen: number;
	type: TxType;
	categoryId: string;
	note?: string | null;
	occurredOn: string;
	clientId: string;
}

export interface FinanceSubInput {
	name: string;
	priceFen: number;
	cycle: SubCycle;
	nextBillingDate: string;
	remindDaysBefore?: number;
}

export interface FinanceBudgetInput {
	categoryId?: string | null;
	monthlyLimitFen: number;
	alertThresholdPct?: number;
}

export interface FinanceChallengeInput {
	name: string;
	targetDays: number;
	startDate?: string;
	targetAmountFen?: number | null;
}

export interface FinanceReport {
	from: string;
	to: string;
	currency: 'CNY';
	expenseFen: number;
	incomeFen: number;
	slices: { categoryId: string; categoryName: string; kind: TxType; amountFen: number }[];
	mom: { expenseFen: number; expenseDeltaFen: number };
	yoy: { expenseFen: number; expenseDeltaFen: number };
}

export function financeTransactionWrite(input: FinanceTxInput): Record<string, unknown> {
	return omitEmpty({
		amount_fen: input.amountFen,
		currency: 'CNY',
		type: input.type,
		category_id: input.categoryId,
		note: input.note?.trim() || undefined,
		occurred_on: input.occurredOn,
		client_id: input.clientId
	});
}

export function financeSubscriptionWrite(input: FinanceSubInput): Record<string, unknown> {
	return omitEmpty({
		name: input.name.trim(),
		price_fen: input.priceFen,
		currency: 'CNY',
		cycle: input.cycle,
		next_billing_date: input.nextBillingDate,
		remind_days_before: input.remindDaysBefore
	});
}

export function financeBudgetWrite(items: FinanceBudgetInput[]): Record<string, unknown> {
	return {
		items: items.map((item) => {
			const row: Record<string, unknown> = {
				monthly_limit_fen: item.monthlyLimitFen
			};
			if (item.categoryId !== undefined) row.category_id = item.categoryId;
			if (item.alertThresholdPct !== undefined) row.alert_threshold_pct = item.alertThresholdPct;
			return row;
		})
	};
}

export function financeChallengeWrite(input: FinanceChallengeInput): Record<string, unknown> {
	return omitEmpty({
		name: input.name.trim(),
		target_days: input.targetDays,
		start_date: input.startDate,
		target_amount_fen:
			input.targetAmountFen == null || input.targetAmountFen <= 0
				? undefined
				: input.targetAmountFen
	});
}

export function financeCheckinWrite(day: string): Record<string, unknown> {
	return { day };
}

export function fromFinanceCategory(value: unknown): FinanceCategory {
	const row = asRecord(value);
	return {
		id: asString(row.id),
		name: asString(row.name),
		kind: asString(row.kind) === 'income' ? 'income' : 'expense',
		system: Boolean(row.system)
	};
}

export function fromFinanceTransaction(value: unknown): FinanceTransaction {
	const row = asRecord(value);
	return {
		id: asString(row.id),
		amountFen: asNumber(row.amount_fen),
		currency: 'CNY',
		type: asString(row.type) === 'income' ? 'income' : 'expense',
		categoryId: asString(row.category_id),
		categoryName: asString(row.category_name),
		note: row.note == null ? null : asString(row.note),
		occurredOn: asString(row.occurred_on),
		clientId: asString(row.client_id),
		createdAt: asString(row.created_at),
		updatedAt: asString(row.updated_at)
	};
}

export function fromFinanceBudget(value: unknown): FinanceBudget {
	const row = asRecord(value);
	return {
		id: asString(row.id),
		categoryId: row.category_id == null ? null : asString(row.category_id),
		categoryName: row.category_name == null ? null : asString(row.category_name),
		monthlyLimitFen: asNumber(row.monthly_limit_fen),
		alertThresholdPct: asNumber(row.alert_threshold_pct, 80),
		spentFen: row.spent_fen == null ? undefined : asNumber(row.spent_fen),
		pct: row.pct == null ? undefined : asNumber(row.pct),
		alert: row.alert == null ? undefined : Boolean(row.alert)
	};
}

export function fromFinanceSubscription(value: unknown): FinanceSubscription {
	const row = asRecord(value);
	const cycle = asString(row.cycle);
	return {
		id: asString(row.id),
		name: asString(row.name),
		priceFen: asNumber(row.price_fen),
		currency: 'CNY',
		cycle: cycle === 'weekly' || cycle === 'quarterly' || cycle === 'yearly' ? cycle : 'monthly',
		nextBillingDate: asString(row.next_billing_date),
		remindDaysBefore: asNumber(row.remind_days_before, 3),
		active: row.active == null ? true : Boolean(row.active),
		annualCostFen: asNumber(row.annual_cost_fen)
	};
}

export function fromFinanceChallenge(value: unknown): FinanceChallenge {
	const row = asRecord(value);
	const checkins = Array.isArray(row.checkins)
		? row.checkins.map((item) => {
				if (typeof item === 'string') return item;
				return asString(asRecord(item).day);
			})
		: [];
	return {
		id: asString(row.id),
		name: asString(row.name),
		targetDays: asNumber(row.target_days),
		targetAmountFen: row.target_amount_fen == null ? null : asNumber(row.target_amount_fen),
		startDate: asString(row.start_date),
		progressDays: asNumber(row.progress_days, checkins.length),
		checkins
	};
}

export function fromFinanceSummary(value: unknown): FinanceSummary {
	const row = asRecord(value);
	return {
		month: asString(row.month),
		currency: 'CNY',
		incomeFen: asNumber(row.income_fen),
		expenseFen: asNumber(row.expense_fen),
		balanceFen: asNumber(row.balance_fen),
		byCategory: (Array.isArray(row.by_category) ? row.by_category : []).map((item) => {
			const slice = asRecord(item);
			return {
				categoryId: asString(slice.category_id),
				categoryName: asString(slice.category_name),
				kind: asString(slice.kind) === 'income' ? 'income' : 'expense',
				amountFen: asNumber(slice.amount_fen)
			};
		}),
		budgets: (Array.isArray(row.budgets) ? row.budgets : []).map(fromFinanceBudget),
		recent: (Array.isArray(row.recent) ? row.recent : []).map(fromFinanceTransaction)
	};
}

export function fromFinanceReport(value: unknown): FinanceReport {
	const row = asRecord(value);
	const mom = asRecord(row.mom);
	const yoy = asRecord(row.yoy);
	return {
		from: asString(row.from),
		to: asString(row.to),
		currency: 'CNY',
		expenseFen: asNumber(row.expense_fen),
		incomeFen: asNumber(row.income_fen),
		slices: (Array.isArray(row.slices) ? row.slices : []).map((item) => {
			const slice = asRecord(item);
			return {
				categoryId: asString(slice.category_id),
				categoryName: asString(slice.category_name ?? slice.key),
				kind: 'expense' as const,
				amountFen: asNumber(slice.amount_fen)
			};
		}),
		mom: {
			expenseFen: asNumber(mom.expense_fen),
			expenseDeltaFen: asNumber(mom.expense_delta_fen)
		},
		yoy: {
			expenseFen: asNumber(yoy.expense_fen),
			expenseDeltaFen: asNumber(yoy.expense_delta_fen)
		}
	};
}

export function listFrom<T>(value: unknown, map: (item: unknown) => T): T[] {
	return itemsOf(value).map(map);
}

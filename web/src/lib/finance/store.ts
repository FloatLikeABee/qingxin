import { enqueueSync, getRecord, openQingxinDb, putRecord } from '../offline/cache';
import { annualCostFen, currentMonth, shiftMonth, todayIso } from './money';
import {
	SYSTEM_CATEGORIES,
	type FinanceBudget,
	type FinanceChallenge,
	type FinanceSubscription,
	type FinanceSummary,
	type FinanceTransaction,
	type SubCycle,
	type TxType
} from './types';

interface AddTxInput {
	amountFen: number;
	type: TxType;
	categoryId: string;
	note?: string | null;
	occurredOn: string;
	clientId: string;
}

interface BudgetInput {
	categoryId: string | null;
	monthlyLimitFen: number;
	alertThresholdPct: number;
}

const CACHE_KEY = 'snapshot';

export class MemoryFinanceStore {
	categories = SYSTEM_CATEGORIES.map((item) => ({ ...item }));
	transactions: FinanceTransaction[] = [];
	budgets: FinanceBudget[] = [];
	subscriptions: FinanceSubscription[] = [];
	challenges: FinanceChallenge[] = [];

	async addTransaction(input: AddTxInput): Promise<FinanceTransaction> {
		const existing = this.transactions.find((row) => row.clientId === input.clientId);
		if (existing) return existing;
		const category = this.categories.find((item) => item.id === input.categoryId);
		if (!category) throw new Error('分类不存在');
		const now = new Date().toISOString();
		const row: FinanceTransaction = {
			id: crypto.randomUUID(),
			amountFen: input.amountFen,
			currency: 'CNY',
			type: input.type,
			categoryId: category.id,
			categoryName: category.name,
			note: input.note?.trim() || null,
			occurredOn: input.occurredOn,
			clientId: input.clientId,
			createdAt: now,
			updatedAt: now
		};
		this.transactions.unshift(row);
		await this.persist();
		return row;
	}

	upsertBudget(input: BudgetInput): FinanceBudget {
		const category = input.categoryId
			? this.categories.find((item) => item.id === input.categoryId)
			: null;
		const found = this.budgets.find((item) => item.categoryId === input.categoryId);
		const row: FinanceBudget = {
			id: found?.id ?? crypto.randomUUID(),
			categoryId: input.categoryId,
			categoryName: category?.name ?? null,
			monthlyLimitFen: input.monthlyLimitFen,
			alertThresholdPct: input.alertThresholdPct
		};
		if (found) {
			Object.assign(found, row);
			void this.persist();
			return found;
		}
		this.budgets.push(row);
		void this.persist();
		return row;
	}

	summary(month = currentMonth()): FinanceSummary {
		const inMonth = this.transactions.filter((row) => row.occurredOn.startsWith(month));
		const incomeFen = inMonth
			.filter((row) => row.type === 'income')
			.reduce((sum, row) => sum + row.amountFen, 0);
		const expenseFen = inMonth
			.filter((row) => row.type === 'expense')
			.reduce((sum, row) => sum + row.amountFen, 0);
		const grouped = new Map<string, FinanceSummary['byCategory'][number]>();
		for (const row of inMonth) {
			const current = grouped.get(row.categoryId) ?? {
				categoryId: row.categoryId,
				categoryName: row.categoryName,
				kind: row.type,
				amountFen: 0
			};
			current.amountFen += row.amountFen;
			grouped.set(row.categoryId, current);
		}
		const budgets = this.budgets.map((budget) => {
			const spentFen = budget.categoryId
				? inMonth
						.filter((row) => row.categoryId === budget.categoryId)
						.reduce((sum, row) => sum + row.amountFen, 0)
				: expenseFen;
			const pct =
				budget.monthlyLimitFen <= 0 ? 0 : Math.floor((spentFen * 100) / budget.monthlyLimitFen);
			return {
				...budget,
				spentFen,
				pct,
				alert: pct >= budget.alertThresholdPct
			};
		});
		return {
			month,
			currency: 'CNY',
			incomeFen,
			expenseFen,
			balanceFen: incomeFen - expenseFen,
			byCategory: [...grouped.values()].sort((a, b) => b.amountFen - a.amountFen),
			budgets,
			recent: [...inMonth]
				.sort(
					(a, b) =>
						b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt)
				)
				.slice(0, 5)
		};
	}

	report(month: string) {
		const current = this.summary(month);
		const mom = this.summary(shiftMonth(month, -1));
		const yoy = this.summary(shiftMonth(month, -12));
		return {
			from: month,
			to: month,
			currency: 'CNY' as const,
			expenseFen: current.expenseFen,
			incomeFen: current.incomeFen,
			slices: current.byCategory.filter((item) => item.kind === 'expense'),
			mom: {
				expenseFen: mom.expenseFen,
				expenseDeltaFen: current.expenseFen - mom.expenseFen
			},
			yoy: {
				expenseFen: yoy.expenseFen,
				expenseDeltaFen: current.expenseFen - yoy.expenseFen
			}
		};
	}

	createSubscription(input: {
		name: string;
		priceFen: number;
		cycle: SubCycle;
		nextBillingDate: string;
		remindDaysBefore?: number;
	}): FinanceSubscription {
		const row: FinanceSubscription = {
			id: crypto.randomUUID(),
			name: input.name,
			priceFen: input.priceFen,
			currency: 'CNY',
			cycle: input.cycle,
			nextBillingDate: input.nextBillingDate,
			remindDaysBefore: input.remindDaysBefore ?? 3,
			active: true,
			annualCostFen: annualCostFen(input.priceFen, input.cycle)
		};
		this.subscriptions.push(row);
		void this.persist();
		return row;
	}

	upcoming(today = todayIso()): FinanceSubscription[] {
		return this.subscriptions.filter((row) => {
			if (!row.active) return false;
			const until = dateDiff(today, row.nextBillingDate);
			return until >= 0 && until <= row.remindDaysBefore;
		});
	}

	createChallenge(input: {
		name: string;
		targetDays: number;
		startDate: string;
	}): FinanceChallenge {
		const row: FinanceChallenge = {
			id: crypto.randomUUID(),
			name: input.name,
			targetDays: input.targetDays,
			targetAmountFen: null,
			startDate: input.startDate,
			progressDays: 0,
			checkins: []
		};
		this.challenges.push(row);
		void this.persist();
		return row;
	}

	checkin(id: string, day: string): FinanceChallenge | undefined {
		const row = this.challenge(id);
		if (!row) return undefined;
		if (!row.checkins.includes(day)) {
			row.checkins.push(day);
			row.progressDays = row.checkins.length;
			void this.persist();
		}
		return row;
	}

	challenge(id: string): FinanceChallenge | undefined {
		return this.challenges.find((item) => item.id === id);
	}

	removeSubscription(id: string) {
		this.subscriptions = this.subscriptions.filter((item) => item.id !== id);
	}

	removeChallenge(id: string) {
		this.challenges = this.challenges.filter((item) => item.id !== id);
	}

	async persist() {
		if (typeof indexedDB === 'undefined') return;
		const db = await openQingxinDb();
		try {
			await putRecord(db, 'finance', CACHE_KEY, this.snapshot());
			await enqueueSync(db, {
				type: 'finance.transaction',
				payload: { count: this.transactions.length }
			});
		} finally {
			db.close();
		}
	}

	async hydrate() {
		if (typeof indexedDB === 'undefined') return;
		const db = await openQingxinDb();
		try {
			const snap = await getRecord<ReturnType<MemoryFinanceStore['snapshot']>>(
				db,
				'finance',
				CACHE_KEY
			);
			if (!snap) return;
			this.transactions = snap.transactions;
			this.budgets = snap.budgets;
			this.subscriptions = snap.subscriptions;
			this.challenges = snap.challenges;
		} finally {
			db.close();
		}
	}

	snapshot() {
		return {
			transactions: this.transactions,
			budgets: this.budgets,
			subscriptions: this.subscriptions,
			challenges: this.challenges
		};
	}
}

function dateDiff(from: string, to: string): number {
	const a = Date.parse(`${from}T00:00:00Z`);
	const b = Date.parse(`${to}T00:00:00Z`);
	return Math.round((b - a) / 86_400_000);
}

let singleton: MemoryFinanceStore | undefined;

export function getFinanceStore(): MemoryFinanceStore {
	singleton ??= new MemoryFinanceStore();
	return singleton;
}

export function resetFinanceStore(next = new MemoryFinanceStore()) {
	singleton = next;
	return singleton;
}

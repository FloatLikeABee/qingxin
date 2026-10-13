import { getApi } from '../api/client';
import { enqueueSync, getRecord, openQingxinDb, putRecord } from '../offline/cache';
import { currentMonth, todayIso } from './money';
import type { FinanceReport } from './payload';
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

export interface AddTxInput {
	amountFen: number;
	type: TxType;
	categoryId: string;
	note?: string | null;
	occurredOn: string;
	clientId: string;
}

export interface BudgetInput {
	categoryId: string | null;
	monthlyLimitFen: number;
	alertThresholdPct: number;
}

const CACHE_KEY = 'snapshot';

function dateDiff(from: string, to: string): number {
	const a = Date.parse(`${from}T00:00:00Z`);
	const b = Date.parse(`${to}T00:00:00Z`);
	return Math.round((b - a) / 86_400_000);
}

function emptySummary(month: string): FinanceSummary {
	return {
		month,
		currency: 'CNY',
		incomeFen: 0,
		expenseFen: 0,
		balanceFen: 0,
		byCategory: [],
		budgets: [],
		recent: []
	};
}

export class FinanceStore {
	categories = SYSTEM_CATEGORIES.map((item) => ({ ...item }));
	transactions: FinanceTransaction[] = [];
	budgets: FinanceBudget[] = [];
	subscriptions: FinanceSubscription[] = [];
	challenges: FinanceChallenge[] = [];
	upcomingSubs: FinanceSubscription[] = [];
	summaryCache: FinanceSummary = emptySummary(currentMonth());
	reportCache: FinanceReport = {
		from: currentMonth(),
		to: currentMonth(),
		currency: 'CNY',
		expenseFen: 0,
		incomeFen: 0,
		slices: [],
		mom: { expenseFen: 0, expenseDeltaFen: 0 },
		yoy: { expenseFen: 0, expenseDeltaFen: 0 }
	};

	async hydrate(month = currentMonth()): Promise<void> {
		try {
			const api = getApi();
			await api.getSession();
			const [
				categories,
				transactions,
				budgets,
				subscriptions,
				challenges,
				upcoming,
				summary,
				report
			] = await Promise.all([
				api.listFinanceCategories().catch(() => this.categories),
				api.listFinanceTransactions(month),
				api.listFinanceBudgets().catch(() => this.budgets),
				api.listFinanceSubscriptions().catch(() => this.subscriptions),
				api.listFinanceChallenges().catch(() => this.challenges),
				api.listUpcomingSubscriptions().catch(() => this.upcomingSubs),
				api.getFinanceSummary(month),
				api.getFinanceReport(month).catch(() => this.report(month))
			]);
			if (categories.length) this.categories = categories;
			this.transactions = transactions;
			this.budgets = budgets;
			this.subscriptions = subscriptions;
			this.challenges = challenges;
			this.upcomingSubs = upcoming;
			this.summaryCache = summary;
			this.reportCache = report;
			await this.persist();
		} catch {
			await this.loadCache();
		}
	}

	async addTransaction(input: AddTxInput): Promise<FinanceTransaction> {
		const existing = this.transactions.find((row) => row.clientId === input.clientId);
		if (existing) return existing;
		const category = this.categories.find((item) => item.id === input.categoryId);
		const now = new Date().toISOString();
		const pending: FinanceTransaction = {
			id: crypto.randomUUID(),
			amountFen: input.amountFen,
			currency: 'CNY',
			type: input.type,
			categoryId: input.categoryId,
			categoryName: category?.name ?? '',
			note: input.note?.trim() || null,
			occurredOn: input.occurredOn,
			clientId: input.clientId,
			createdAt: now,
			updatedAt: now
		};
		this.transactions = [pending, ...this.transactions];
		try {
			const saved = await getApi().createFinanceTransaction(input);
			this.transactions = this.transactions.map((row) =>
				row.clientId === input.clientId ? saved : row
			);
			try {
				await this.refreshDerived(input.occurredOn.slice(0, 7));
				await this.persist();
			} catch {
				this.summaryCache = this.computeSummary(input.occurredOn.slice(0, 7));
			}
			return saved;
		} catch (error) {
			if (typeof navigator !== 'undefined' && !navigator.onLine) {
				await this.enqueue('finance_transaction_create', input);
				await this.persist();
				return pending;
			}
			this.transactions = this.transactions.filter((row) => row.clientId !== input.clientId);
			throw error;
		}
	}

	async upsertBudget(input: BudgetInput): Promise<FinanceBudget> {
		const items = await getApi().putFinanceBudgets([input]);
		this.budgets = items;
		const row =
			items.find((item) => item.categoryId === input.categoryId) ??
			items[items.length - 1] ??
			({
				id: crypto.randomUUID(),
				categoryId: input.categoryId,
				categoryName: this.categories.find((item) => item.id === input.categoryId)?.name ?? null,
				monthlyLimitFen: input.monthlyLimitFen,
				alertThresholdPct: input.alertThresholdPct
			} satisfies FinanceBudget);
		await this.refreshDerived();
		await this.persist();
		return row;
	}

	summary(month = currentMonth()): FinanceSummary {
		if (this.summaryCache.month === month) return this.summaryCache;
		return this.computeSummary(month);
	}

	report(month: string): FinanceReport {
		if (this.reportCache.from === month) return this.reportCache;
		const current = this.summary(month);
		return {
			from: month,
			to: month,
			currency: 'CNY',
			expenseFen: current.expenseFen,
			incomeFen: current.incomeFen,
			slices: current.byCategory.filter((item) => item.kind === 'expense'),
			mom: { expenseFen: 0, expenseDeltaFen: current.expenseFen },
			yoy: { expenseFen: 0, expenseDeltaFen: current.expenseFen }
		};
	}

	upcoming(today = todayIso()): FinanceSubscription[] {
		if (this.upcomingSubs.length) return this.upcomingSubs;
		return this.subscriptions.filter((row) => {
			if (!row.active) return false;
			const until = dateDiff(today, row.nextBillingDate);
			return until >= 0 && until <= row.remindDaysBefore;
		});
	}

	async createSubscription(input: {
		name: string;
		priceFen: number;
		cycle: SubCycle;
		nextBillingDate: string;
		remindDaysBefore?: number;
	}): Promise<FinanceSubscription> {
		const row = await getApi().createFinanceSubscription(input);
		this.subscriptions = [...this.subscriptions, row];
		this.upcomingSubs = await getApi()
			.listUpcomingSubscriptions()
			.catch(() => this.upcoming());
		await this.persist();
		return row;
	}

	async createChallenge(input: {
		name: string;
		targetDays: number;
		startDate: string;
	}): Promise<FinanceChallenge> {
		const row = await getApi().createFinanceChallenge(input);
		this.challenges = [row, ...this.challenges];
		await this.persist();
		return row;
	}

	async checkin(id: string, day: string): Promise<FinanceChallenge | undefined> {
		const row = await getApi().checkinFinanceChallenge(id, day);
		this.challenges = this.challenges.map((item) => (item.id === id ? row : item));
		await this.persist();
		return row;
	}

	challenge(id: string): FinanceChallenge | undefined {
		return this.challenges.find((item) => item.id === id);
	}

	async removeSubscription(id: string) {
		await getApi().deleteFinanceSubscription(id);
		this.subscriptions = this.subscriptions.filter((item) => item.id !== id);
		this.upcomingSubs = this.upcomingSubs.filter((item) => item.id !== id);
		await this.persist();
	}

	async removeChallenge(id: string) {
		await getApi().deleteFinanceChallenge(id);
		this.challenges = this.challenges.filter((item) => item.id !== id);
		await this.persist();
	}

	private computeSummary(month: string): FinanceSummary {
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
			return { ...budget, spentFen, pct, alert: pct >= budget.alertThresholdPct };
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

	private async refreshDerived(month = currentMonth()) {
		try {
			const api = getApi();
			this.summaryCache = await api.getFinanceSummary(month);
			this.reportCache = await api.getFinanceReport(month);
		} catch {
			this.summaryCache = this.computeSummary(month);
		}
	}

	private async enqueue(type: string, payload: unknown) {
		if (typeof indexedDB === 'undefined') return;
		const db = await openQingxinDb();
		try {
			await enqueueSync(db, { type, payload });
		} finally {
			db.close();
		}
	}

	async persist() {
		if (typeof indexedDB === 'undefined') return;
		const db = await openQingxinDb();
		try {
			await putRecord(db, 'finance', CACHE_KEY, this.snapshot());
		} finally {
			db.close();
		}
	}

	async loadCache() {
		if (typeof indexedDB === 'undefined') return;
		const db = await openQingxinDb();
		try {
			const snap = await getRecord<ReturnType<FinanceStore['snapshot']>>(db, 'finance', CACHE_KEY);
			if (!snap) return;
			this.transactions = snap.transactions;
			this.budgets = snap.budgets;
			this.subscriptions = snap.subscriptions;
			this.challenges = snap.challenges;
			this.upcomingSubs = snap.upcomingSubs ?? [];
			if (snap.summary) this.summaryCache = snap.summary;
		} finally {
			db.close();
		}
	}

	snapshot() {
		return {
			transactions: this.transactions,
			budgets: this.budgets,
			subscriptions: this.subscriptions,
			challenges: this.challenges,
			upcomingSubs: this.upcomingSubs,
			summary: this.summaryCache
		};
	}
}

export { FinanceStore as MemoryFinanceStore };

let singleton: FinanceStore | undefined;

export function getFinanceStore(): FinanceStore {
	singleton ??= new FinanceStore();
	return singleton;
}

export function resetFinanceStore(next = new FinanceStore()) {
	singleton = next;
	return singleton;
}

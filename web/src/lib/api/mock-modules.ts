import { EMERGENCY_CONTACTS, type ElderContact, type ElderReminder } from '../elder/demo';
import type { ElderReminderInput, ElderToday } from '../elder/payload';
import { REMINDER_DISCLAIMER, MEDICAL_DISCLAIMER } from '../elder/schedule';
import { annualCostFen } from '../finance/money';
import type {
	FinanceBudgetInput,
	FinanceChallengeInput,
	FinanceReport,
	FinanceSubInput,
	FinanceTxInput
} from '../finance/payload';
import {
	SYSTEM_CATEGORIES,
	type FinanceBudget,
	type FinanceChallenge,
	type FinanceSubscription,
	type FinanceSummary,
	type FinanceTransaction
} from '../finance/types';
import { DISCLAIMER } from '../wellness/disclaimer';
import { DEFAULT_CUP_ML, DEFAULT_TARGET_ML } from '../wellness/water';
import type {
	CycleLog,
	PlanLog,
	ReminderLog,
	ReportLog,
	SleepLog,
	TodaySnapshot,
	WaterLog
} from '../wellness/types';
import { ApiError, type Session } from './types';

function nid(): string {
	return crypto.randomUUID();
}

function nowIso(): string {
	return new Date().toISOString();
}

export class QingxinModuleMemory {
	#transactions = new Map<string, FinanceTransaction[]>();
	#budgets = new Map<string, FinanceBudget[]>();
	#subs = new Map<string, FinanceSubscription[]>();
	#challenges = new Map<string, FinanceChallenge[]>();
	#reminders = new Map<string, ElderReminder[]>();
	#contacts = new Map<string, ElderContact[]>();
	#profiles = new Map<string, { activityLogOptIn: boolean; timezone: string }>();
	#acks = new Map<string, string[]>();
	#water = new Map<string, WaterLog[]>();
	#sleep = new Map<string, SleepLog[]>();
	#cycles = new Map<string, CycleLog[]>();
	#reports = new Map<string, ReportLog[]>();
	#plans = new Map<string, PlanLog[]>();
	#wellReminders = new Map<string, ReminderLog[]>();
	#consent = new Map<string, boolean>();
	#targets = new Map<string, number>();
	#jobs: {
		id: string;
		kind: string;
		runAt: string;
		status: string;
		payload: Record<string, unknown>;
	}[] = [];

	constructor(private readonly session: () => Session) {}

	#uid(): string {
		return this.session().userId;
	}

	#list<T>(map: Map<string, T[]>, userId = this.#uid()): T[] {
		return map.get(userId) ?? [];
	}

	#set<T>(map: Map<string, T[]>, items: T[], userId = this.#uid()) {
		map.set(userId, items);
	}

	async listFinanceCategories() {
		return SYSTEM_CATEGORIES.map((item) => ({ ...item }));
	}

	async createFinanceTransaction(input: FinanceTxInput): Promise<FinanceTransaction> {
		const existing = this.#list(this.#transactions).find((row) => row.clientId === input.clientId);
		if (existing) return existing;
		const category = SYSTEM_CATEGORIES.find((item) => item.id === input.categoryId);
		if (!category) throw new ApiError('invalid_request', '分类不存在');
		if (category.kind !== input.type) throw new ApiError('invalid_request', '分类与类型不符');
		const now = nowIso();
		const row: FinanceTransaction = {
			id: nid(),
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
		this.#set(this.#transactions, [row, ...this.#list(this.#transactions)]);
		return row;
	}

	async listFinanceTransactions(month?: string): Promise<FinanceTransaction[]> {
		return this.#list(this.#transactions).filter((row) =>
			month ? row.occurredOn.startsWith(month) : true
		);
	}

	async getFinanceSummary(month: string): Promise<FinanceSummary> {
		const inMonth = this.#list(this.#transactions).filter((row) =>
			row.occurredOn.startsWith(month)
		);
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
		const budgets = this.#list(this.#budgets).map((budget) => {
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

	async getFinanceReport(month: string): Promise<FinanceReport> {
		const current = await this.getFinanceSummary(month);
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

	async listFinanceBudgets(): Promise<FinanceBudget[]> {
		return this.#list(this.#budgets);
	}

	async putFinanceBudgets(items: FinanceBudgetInput[]): Promise<FinanceBudget[]> {
		const next = [...this.#list(this.#budgets)];
		for (const item of items) {
			const category = item.categoryId
				? SYSTEM_CATEGORIES.find((row) => row.id === item.categoryId)
				: null;
			const found = next.find((row) => row.categoryId === (item.categoryId ?? null));
			const row: FinanceBudget = {
				id: found?.id ?? nid(),
				categoryId: item.categoryId ?? null,
				categoryName: category?.name ?? null,
				monthlyLimitFen: item.monthlyLimitFen,
				alertThresholdPct: item.alertThresholdPct ?? 80
			};
			if (found) Object.assign(found, row);
			else next.push(row);
		}
		this.#set(this.#budgets, next);
		return next;
	}

	async listFinanceSubscriptions(): Promise<FinanceSubscription[]> {
		return this.#list(this.#subs);
	}

	async listUpcomingSubscriptions(): Promise<FinanceSubscription[]> {
		return this.#list(this.#subs).filter((row) => row.active);
	}

	async createFinanceSubscription(input: FinanceSubInput): Promise<FinanceSubscription> {
		const row: FinanceSubscription = {
			id: nid(),
			name: input.name,
			priceFen: input.priceFen,
			currency: 'CNY',
			cycle: input.cycle,
			nextBillingDate: input.nextBillingDate,
			remindDaysBefore: input.remindDaysBefore ?? 3,
			active: true,
			annualCostFen: annualCostFen(input.priceFen, input.cycle)
		};
		this.#set(this.#subs, [...this.#list(this.#subs), row]);
		return row;
	}

	async deleteFinanceSubscription(id: string): Promise<void> {
		this.#set(
			this.#subs,
			this.#list(this.#subs).filter((item) => item.id !== id)
		);
	}

	async listFinanceChallenges(): Promise<FinanceChallenge[]> {
		return this.#list(this.#challenges);
	}

	async createFinanceChallenge(input: FinanceChallengeInput): Promise<FinanceChallenge> {
		const row: FinanceChallenge = {
			id: nid(),
			name: input.name,
			targetDays: input.targetDays,
			targetAmountFen: input.targetAmountFen ?? null,
			startDate: input.startDate ?? nowIso().slice(0, 10),
			progressDays: 0,
			checkins: []
		};
		this.#set(this.#challenges, [row, ...this.#list(this.#challenges)]);
		return row;
	}

	async checkinFinanceChallenge(id: string, day: string): Promise<FinanceChallenge> {
		const row = this.#list(this.#challenges).find((item) => item.id === id);
		if (!row) throw new ApiError('not_found', '未找到挑战');
		if (!row.checkins.includes(day)) {
			row.checkins.push(day);
			row.progressDays = row.checkins.length;
		}
		return row;
	}

	async deleteFinanceChallenge(id: string): Promise<void> {
		this.#set(
			this.#challenges,
			this.#list(this.#challenges).filter((item) => item.id !== id)
		);
	}

	async createJob(input: { runAt: string; title: string; body: string }) {
		const row = {
			id: nid(),
			kind: 'web_push',
			runAt: input.runAt,
			status: 'pending',
			payload: { title: input.title, body: input.body }
		};
		this.#jobs.push(row);
		return row;
	}

	async getElderToday(elderId?: string): Promise<ElderToday> {
		const id = elderId && elderId !== 'me' ? elderId : this.#uid();
		return {
			elderUserId: id,
			reminders: this.#list(this.#reminders, id),
			due: [],
			contacts: [...EMERGENCY_CONTACTS, ...this.#list(this.#contacts, id)],
			disclaimer: REMINDER_DISCLAIMER,
			medicalDisclaimer: MEDICAL_DISCLAIMER
		};
	}

	async listElderReminders(elderId?: string): Promise<ElderReminder[]> {
		const id = elderId && elderId !== 'me' ? elderId : this.#uid();
		return this.#list(this.#reminders, id);
	}

	async createElderReminder(input: ElderReminderInput, elderId?: string): Promise<ElderReminder> {
		const id = elderId && elderId !== 'me' ? elderId : this.#uid();
		const row: ElderReminder = {
			id: nid(),
			title: input.title,
			body: input.body,
			kind: input.kind ?? 'medication',
			time: input.time,
			daysOfWeek: input.daysOfWeek,
			voiceText: input.voiceText ?? `${input.title}，${input.body}`
		};
		this.#set(this.#reminders, [...this.#list(this.#reminders, id), row], id);
		return row;
	}

	async ackElderReminder(
		reminderId: string,
		_occurrenceAt: string,
		elderId?: string
	): Promise<void> {
		const id = elderId && elderId !== 'me' ? elderId : this.#uid();
		const key = `${id}:${reminderId}`;
		const current = this.#acks.get(key) ?? [];
		current.push(nowIso());
		this.#acks.set(key, current);
	}

	async listElderContacts(elderId?: string): Promise<ElderContact[]> {
		const id = elderId && elderId !== 'me' ? elderId : this.#uid();
		return [...EMERGENCY_CONTACTS, ...this.#list(this.#contacts, id)];
	}

	async getElderProfile(elderId?: string) {
		const id = elderId && elderId !== 'me' ? elderId : this.#uid();
		const profile = this.#profiles.get(id) ?? {
			activityLogOptIn: false,
			timezone: 'Asia/Shanghai'
		};
		return { userId: id, ...profile };
	}

	async patchElderProfile(
		input: { activityLogOptIn?: boolean; timezone?: string },
		elderId?: string
	) {
		const id = elderId && elderId !== 'me' ? elderId : this.#uid();
		const current = this.#profiles.get(id) ?? {
			activityLogOptIn: false,
			timezone: 'Asia/Shanghai'
		};
		const next = {
			activityLogOptIn: input.activityLogOptIn ?? current.activityLogOptIn,
			timezone: input.timezone ?? current.timezone
		};
		this.#profiles.set(id, next);
		return { userId: id, ...next };
	}

	async getWellnessToday(): Promise<TodaySnapshot> {
		const date = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
		const totalMl = this.#list(this.#water)
			.filter((row) => row.loggedOn === date)
			.reduce((sum, row) => sum + row.ml, 0);
		return {
			disclaimer: DISCLAIMER,
			date,
			water: {
				totalMl,
				targetMl: this.#targets.get(this.#uid()) ?? DEFAULT_TARGET_ML,
				cupMl: DEFAULT_CUP_ML
			},
			sleep: this.#list(this.#sleep)[0] ?? null,
			cycleConsent: this.#consent.get(this.#uid()) ?? false
		};
	}

	async addWellnessWater(ml: number, loggedOn: string): Promise<WaterLog> {
		const row: WaterLog = { id: nid(), loggedOn, ml, loggedAt: nowIso() };
		this.#set(this.#water, [row, ...this.#list(this.#water)]);
		return row;
	}

	async listWellnessWater(): Promise<WaterLog[]> {
		return this.#list(this.#water);
	}

	async addWellnessSleep(input: {
		sleepAt: string;
		wakeAt: string;
		quality: number;
		note?: string | null;
	}): Promise<SleepLog> {
		const row: SleepLog = {
			id: nid(),
			sleepAt: input.sleepAt,
			wakeAt: input.wakeAt,
			quality: input.quality,
			note: input.note?.trim() || null,
			createdAt: nowIso()
		};
		this.#set(this.#sleep, [row, ...this.#list(this.#sleep)]);
		return row;
	}

	async listWellnessSleep(): Promise<SleepLog[]> {
		return this.#list(this.#sleep);
	}

	async putWellnessConsent(cycleConsent: boolean) {
		this.#consent.set(this.#uid(), cycleConsent);
		if (!cycleConsent) this.#set(this.#cycles, []);
		return { cycleConsent };
	}

	async addWellnessCycle(input: {
		startDate: string;
		endDate?: string | null;
		flowLevel?: CycleLog['flowLevel'];
		symptoms?: string | null;
	}): Promise<CycleLog> {
		if (!this.#consent.get(this.#uid())) throw new ApiError('forbidden', '需要先开启经期记录同意');
		const row: CycleLog = {
			id: nid(),
			startDate: input.startDate,
			endDate: input.endDate ?? null,
			flowLevel: input.flowLevel ?? null,
			symptoms: input.symptoms ?? null
		};
		this.#set(this.#cycles, [row, ...this.#list(this.#cycles)]);
		return row;
	}

	async listWellnessCycles(): Promise<CycleLog[]> {
		return this.#list(this.#cycles);
	}

	async addWellnessReport(input: {
		title: string;
		reportDate: string;
		metrics: ReportLog['metrics'];
	}): Promise<ReportLog> {
		const row: ReportLog = {
			id: nid(),
			title: input.title,
			reportDate: input.reportDate,
			metrics: input.metrics,
			source: 'manual',
			confirmed: true
		};
		this.#set(this.#reports, [row, ...this.#list(this.#reports)]);
		return row;
	}

	async listWellnessReports(): Promise<ReportLog[]> {
		return this.#list(this.#reports);
	}

	async createWellnessPlan(kind: PlanLog['kind']): Promise<PlanLog> {
		const row: PlanLog = {
			id: nid(),
			kind,
			title: kind === 'water_21' ? '21天喝水挑战' : '21天睡眠打卡',
			targetDays: 21,
			startDate: nowIso().slice(0, 10),
			progressDays: 0,
			checkins: []
		};
		this.#set(this.#plans, [row, ...this.#list(this.#plans)]);
		return row;
	}

	async listWellnessPlans(): Promise<PlanLog[]> {
		return this.#list(this.#plans);
	}

	async checkinWellnessPlan(id: string, day: string): Promise<PlanLog> {
		const row = this.#list(this.#plans).find((item) => item.id === id);
		if (!row) throw new ApiError('not_found', '未找到计划');
		if (!row.checkins.includes(day)) {
			row.checkins.push(day);
			row.progressDays = row.checkins.length;
		}
		return row;
	}

	async listWellnessReminders(): Promise<ReminderLog[]> {
		return this.#list(this.#wellReminders);
	}

	async createWellnessReminder(input: {
		kind: ReminderLog['kind'];
		time: string;
		daysOfWeek: number[];
	}): Promise<ReminderLog> {
		const row: ReminderLog = {
			id: nid(),
			kind: input.kind,
			time: input.time,
			daysOfWeek: input.daysOfWeek
		};
		this.#set(this.#wellReminders, [...this.#list(this.#wellReminders), row]);
		return row;
	}
}

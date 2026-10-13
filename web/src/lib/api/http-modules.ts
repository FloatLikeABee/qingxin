import {
	elderAckWrite,
	elderProfileWrite,
	elderReminderWrite,
	fromElderContact,
	fromElderProfile,
	fromElderReminder,
	fromElderToday,
	fromJob,
	webPushJobWrite
} from '../elder/payload';
import {
	financeBudgetWrite,
	financeChallengeWrite,
	financeCheckinWrite,
	financeSubscriptionWrite,
	financeTransactionWrite,
	fromFinanceBudget,
	fromFinanceCategory,
	fromFinanceChallenge,
	fromFinanceReport,
	fromFinanceSubscription,
	fromFinanceSummary,
	fromFinanceTransaction,
	listFrom,
	type FinanceBudgetInput,
	type FinanceChallengeInput,
	type FinanceSubInput,
	type FinanceTxInput
} from '../finance/payload';
import {
	fromCycleLog,
	fromPlanLog,
	fromReminderLog,
	fromReportLog,
	fromSleepLog,
	fromWaterLog,
	fromWellnessToday,
	wellnessCheckinWrite,
	wellnessConsentWrite,
	wellnessCycleWrite,
	wellnessPlanWrite,
	wellnessReminderWrite,
	wellnessReportWrite,
	wellnessSleepWrite,
	wellnessWaterWrite
} from '../wellness/payload';
import { itemsOf } from './wire';
import { ApiError } from './types';
import type { CycleLog, PlanLog, ReminderLog, ReportLog } from '../wellness/types';
import type { ElderReminderInput } from '../elder/payload';

export type JsonCall = <T>(
	method: string,
	path: string,
	options?: { json?: unknown; auth?: boolean }
) => Promise<T>;

function elderId(id?: string): string {
	return encodeURIComponent(id && id !== '' ? id : 'me');
}

export function createHttpModules(json: JsonCall) {
	const modules = {
		async listFinanceCategories() {
			return listFrom(await json('GET', '/v1/finance/categories'), fromFinanceCategory);
		},
		async createFinanceTransaction(input: FinanceTxInput) {
			return fromFinanceTransaction(
				await json('POST', '/v1/finance/transactions', { json: financeTransactionWrite(input) })
			);
		},
		async listFinanceTransactions(month?: string) {
			const path = month
				? `/v1/finance/transactions?month=${encodeURIComponent(month)}`
				: '/v1/finance/transactions';
			return listFrom(await json('GET', path), fromFinanceTransaction);
		},
		async getFinanceSummary(month: string) {
			return fromFinanceSummary(
				await json('GET', `/v1/finance/summary?month=${encodeURIComponent(month)}`)
			);
		},
		async getFinanceReport(month: string) {
			return fromFinanceReport(
				await json(
					'GET',
					`/v1/finance/report?from=${encodeURIComponent(month)}&to=${encodeURIComponent(month)}`
				)
			);
		},
		async listFinanceBudgets() {
			return listFrom(await json('GET', '/v1/finance/budgets'), fromFinanceBudget);
		},
		async putFinanceBudgets(items: FinanceBudgetInput[]) {
			return listFrom(
				await json('PUT', '/v1/finance/budgets', { json: financeBudgetWrite(items) }),
				fromFinanceBudget
			);
		},
		async listFinanceSubscriptions() {
			return listFrom(await json('GET', '/v1/finance/subscriptions'), fromFinanceSubscription);
		},
		async listUpcomingSubscriptions() {
			return listFrom(
				await json('GET', '/v1/finance/subscriptions/upcoming'),
				fromFinanceSubscription
			);
		},
		async createFinanceSubscription(input: FinanceSubInput) {
			return fromFinanceSubscription(
				await json('POST', '/v1/finance/subscriptions', { json: financeSubscriptionWrite(input) })
			);
		},
		async deleteFinanceSubscription(id: string) {
			await json('DELETE', `/v1/finance/subscriptions/${encodeURIComponent(id)}`);
		},
		async listFinanceChallenges() {
			return listFrom(await json('GET', '/v1/finance/challenges'), fromFinanceChallenge);
		},
		async createFinanceChallenge(input: FinanceChallengeInput) {
			return fromFinanceChallenge(
				await json('POST', '/v1/finance/challenges', { json: financeChallengeWrite(input) })
			);
		},
		async checkinFinanceChallenge(id: string, day: string) {
			await json('POST', `/v1/finance/challenges/${encodeURIComponent(id)}/checkins`, {
				json: financeCheckinWrite(day)
			});
			const found = (await modules.listFinanceChallenges()).find((item) => item.id === id);
			if (!found) throw new ApiError('not_found', '未找到挑战');
			return found;
		},
		async deleteFinanceChallenge(id: string) {
			await json('DELETE', `/v1/finance/challenges/${encodeURIComponent(id)}`);
		},
		async createJob(input: { runAt: string; title: string; body: string }) {
			return fromJob(await json('POST', '/v1/jobs', { json: webPushJobWrite(input) }));
		},
		async getElderToday(id?: string) {
			const suffix = id && id !== 'me' ? `?elder_id=${encodeURIComponent(id)}` : '';
			return fromElderToday(await json('GET', `/v1/elder/today${suffix}`));
		},
		async listElderReminders(id?: string) {
			return listFrom(await json('GET', `/v1/elder/${elderId(id)}/reminders`), fromElderReminder);
		},
		async createElderReminder(input: ElderReminderInput, id?: string) {
			return fromElderReminder(
				await json('POST', `/v1/elder/${elderId(id)}/reminders`, {
					json: elderReminderWrite(input)
				})
			);
		},
		async ackElderReminder(reminderId: string, occurrenceAt: string, id?: string) {
			await json(
				'POST',
				`/v1/elder/${elderId(id)}/reminders/${encodeURIComponent(reminderId)}/ack`,
				{ json: elderAckWrite(occurrenceAt) }
			);
		},
		async listElderContacts(id?: string) {
			return listFrom(await json('GET', `/v1/elder/${elderId(id)}/contacts`), fromElderContact);
		},
		async getElderProfile(id?: string) {
			return fromElderProfile(await json('GET', `/v1/elder/${elderId(id)}/profile`));
		},
		async patchElderProfile(input: { activityLogOptIn?: boolean; timezone?: string }, id?: string) {
			return fromElderProfile(
				await json('PATCH', `/v1/elder/${elderId(id)}/profile`, {
					json: elderProfileWrite(input)
				})
			);
		},
		async getWellnessToday() {
			return fromWellnessToday(await json('GET', '/v1/wellness/today'));
		},
		async addWellnessWater(ml: number, loggedOn: string) {
			return fromWaterLog(
				await json('POST', '/v1/wellness/water', { json: wellnessWaterWrite(ml, loggedOn) })
			);
		},
		async listWellnessWater() {
			return listFrom(await json('GET', '/v1/wellness/water'), fromWaterLog);
		},
		async addWellnessSleep(input: {
			sleepAt: string;
			wakeAt: string;
			quality: number;
			note?: string | null;
		}) {
			return fromSleepLog(
				await json('POST', '/v1/wellness/sleep', { json: wellnessSleepWrite(input) })
			);
		},
		async listWellnessSleep() {
			return listFrom(await json('GET', '/v1/wellness/sleep'), fromSleepLog);
		},
		async putWellnessConsent(cycleConsent: boolean) {
			const row = (await json('PUT', '/v1/wellness/consent', {
				json: wellnessConsentWrite(cycleConsent)
			})) as { cycle_consent?: boolean };
			return { cycleConsent: Boolean(row.cycle_consent ?? cycleConsent) };
		},
		async addWellnessCycle(input: {
			startDate: string;
			endDate?: string | null;
			flowLevel?: CycleLog['flowLevel'];
			symptoms?: string | null;
		}) {
			return fromCycleLog(
				await json('POST', '/v1/wellness/cycles', { json: wellnessCycleWrite(input) })
			);
		},
		async listWellnessCycles() {
			return listFrom(await json('GET', '/v1/wellness/cycles'), fromCycleLog);
		},
		async addWellnessReport(input: {
			title: string;
			reportDate: string;
			metrics: ReportLog['metrics'];
		}) {
			return fromReportLog(
				await json('POST', '/v1/wellness/reports', { json: wellnessReportWrite(input) })
			);
		},
		async listWellnessReports() {
			return listFrom(await json('GET', '/v1/wellness/reports'), fromReportLog);
		},
		async createWellnessPlan(kind: PlanLog['kind']) {
			return fromPlanLog(
				await json('POST', '/v1/wellness/plans', { json: wellnessPlanWrite(kind) })
			);
		},
		async listWellnessPlans() {
			return listFrom(await json('GET', '/v1/wellness/plans'), fromPlanLog);
		},
		async checkinWellnessPlan(id: string, day: string) {
			await json('POST', `/v1/wellness/plans/${encodeURIComponent(id)}/checkins`, {
				json: wellnessCheckinWrite(day)
			});
			const found = (await modules.listWellnessPlans()).find((item) => item.id === id);
			if (!found) throw new ApiError('not_found', '未找到计划');
			return found;
		},
		async listWellnessReminders() {
			return listFrom(await json('GET', '/v1/wellness/reminders'), fromReminderLog);
		},
		async createWellnessReminder(input: {
			kind: ReminderLog['kind'];
			time: string;
			daysOfWeek: number[];
		}) {
			return fromReminderLog(
				await json('POST', '/v1/wellness/reminders', { json: wellnessReminderWrite(input) })
			);
		}
	};
	return modules;
}

export function items(value: unknown): unknown[] {
	return itemsOf(value);
}

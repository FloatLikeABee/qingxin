import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { MockQingxinApi } from '../api/mock';
import { resetApi } from '../api/client';
import { annualCostFen } from './money';
import { FinanceStore, resetFinanceStore } from './store';

async function loggedStore() {
	const api = new MockQingxinApi();
	await api.login('demo@qingxin.app', 'qingxin');
	resetApi(api);
	const store = resetFinanceStore(new FinanceStore());
	await store.hydrate();
	return store;
}

afterEach(async () => {
	resetApi();
	resetFinanceStore();
	await new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase('qingxin');
		request.onsuccess = () => resolve();
		request.onerror = () => resolve();
		request.onblocked = () => resolve();
	});
});

describe('FinanceStore', () => {
	it('keeps a repeated client_id as one transaction', async () => {
		const store = await loggedStore();
		const food = store.categories.find((item) => item.name === '餐饮');
		expect(food).toBeTruthy();
		const payload = {
			amountFen: 2550,
			type: 'expense' as const,
			categoryId: food!.id,
			note: '午饭',
			occurredOn: '2026-10-13',
			clientId: '11111111-1111-4111-8111-111111111111'
		};
		const first = await store.addTransaction(payload);
		const again = await store.addTransaction(payload);
		expect(again.id).toBe(first.id);
		expect(store.transactions).toHaveLength(1);
	});

	it('computes a budget alert at 85 percent', async () => {
		const store = await loggedStore();
		const food = store.categories.find((item) => item.name === '餐饮')!;
		await store.upsertBudget({
			categoryId: food.id,
			monthlyLimitFen: 100_000,
			alertThresholdPct: 80
		});
		await store.addTransaction({
			amountFen: 85_000,
			type: 'expense',
			categoryId: food.id,
			occurredOn: '2026-10-08',
			clientId: '55555555-5555-4555-8555-555555555555'
		});
		const summary = store.summary('2026-10');
		const budget = summary.budgets.find((item) => item.categoryId === food.id);
		expect(budget?.pct).toBe(85);
		expect(budget?.alert).toBe(true);
		expect(summary.recent).toHaveLength(1);
	});

	it('annualises a monthly 30 yuan subscription to 360 yuan', () => {
		expect(annualCostFen(3000, 'monthly')).toBe(36_000);
	});

	it('takes annual cost from the API subscription', async () => {
		const store = await loggedStore();
		const row = await store.createSubscription({
			name: '音乐会员',
			priceFen: 3000,
			cycle: 'monthly',
			nextBillingDate: '2026-10-15',
			remindDaysBefore: 3
		});
		expect(row.annualCostFen).toBe(36_000);
	});

	it('counts a double check-in as one day', async () => {
		const store = await loggedStore();
		const challenge = await store.createChallenge({
			name: '不买奶茶 30 天',
			targetDays: 30,
			startDate: '2026-10-01'
		});
		await store.checkin(challenge.id, '2026-10-13');
		await store.checkin(challenge.id, '2026-10-13');
		expect(store.challenge(challenge.id)?.progressDays).toBe(1);
	});
});

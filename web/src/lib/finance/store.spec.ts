import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { annualCostFen } from './money';
import { MemoryFinanceStore } from './store';

afterEach(async () => {
	await new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase('qingxin');
		request.onsuccess = () => resolve();
		request.onerror = () => resolve();
		request.onblocked = () => resolve();
	});
});

describe('MemoryFinanceStore', () => {
	it('keeps a repeated client_id as one transaction', async () => {
		const store = new MemoryFinanceStore();
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

	it('computes a budget alert at 85 percent', () => {
		const store = new MemoryFinanceStore();
		const food = store.categories.find((item) => item.name === '餐饮')!;
		store.upsertBudget({
			categoryId: food.id,
			monthlyLimitFen: 100_000,
			alertThresholdPct: 80
		});
		store.transactions.push({
			id: 'tx-1',
			amountFen: 85_000,
			currency: 'CNY',
			type: 'expense',
			categoryId: food.id,
			categoryName: '餐饮',
			note: null,
			occurredOn: '2026-10-08',
			clientId: 'c1',
			createdAt: '2026-10-08T00:00:00Z',
			updatedAt: '2026-10-08T00:00:00Z'
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

	it('counts a double check-in as one day', () => {
		const store = new MemoryFinanceStore();
		const challenge = store.createChallenge({
			name: '不买奶茶 30 天',
			targetDays: 30,
			startDate: '2026-10-01'
		});
		store.checkin(challenge.id, '2026-10-13');
		store.checkin(challenge.id, '2026-10-13');
		expect(store.challenge(challenge.id)?.progressDays).toBe(1);
	});
});

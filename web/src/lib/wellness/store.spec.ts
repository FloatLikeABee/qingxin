import { afterEach, describe, expect, it } from 'vitest';
import { MockQingxinApi } from '../api/mock';
import { resetApi } from '../api/client';
import { resetWellnessStore, WellnessStore } from './store';

async function loggedStore() {
	const api = new MockQingxinApi();
	await api.login('demo@qingxin.app', 'qingxin');
	resetApi(api);
	const store = resetWellnessStore(new WellnessStore());
	await store.hydrate();
	return store;
}

afterEach(() => {
	resetApi();
	resetWellnessStore();
});

describe('WellnessStore', () => {
	it('does not let a stale hydrate wipe a cup posted while loading', async () => {
		const api = new MockQingxinApi();
		await api.login('demo@qingxin.app', 'qingxin');
		resetApi(api);
		const store = resetWellnessStore(new WellnessStore());
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const listWater = api.listWellnessWater.bind(api);
		api.listWellnessWater = async () => {
			await gate;
			return listWater();
		};
		const hydrating = store.hydrate();
		await store.addWater(250, '2026-10-13');
		release();
		await hydrating;
		expect(store.today('2026-10-13').water.totalMl).toBe(250);
	});

	it('adds four cups toward the 2000 ml ring', async () => {
		const store = await loggedStore();
		for (let i = 0; i < 4; i += 1) {
			await store.addWater(250, '2026-10-13');
		}
		const today = store.today('2026-10-13');
		expect(today.water.totalMl).toBe(1000);
		expect(today.water.targetMl).toBe(2000);
		expect(today.disclaimer).toContain('不构成医疗建议');
	});

	it('does not store cycles without consent', async () => {
		const store = await loggedStore();
		expect(store.cycleConsent).toBe(false);
		await expect(store.addCycle({ startDate: '2026-08-01', symptoms: '痛经' })).rejects.toThrow(
			/consent/i
		);
		expect(store.cycles).toHaveLength(0);
		await store.setCycleConsent(true);
		await store.addCycle({ startDate: '2026-08-01', symptoms: '痛经' });
		expect(store.cycles).toHaveLength(1);
		await store.setCycleConsent(false);
		expect(store.cycles).toHaveLength(0);
	});

	it('counts a double plan check-in as one day', async () => {
		const store = await loggedStore();
		const plan = await store.createPlan('water_21');
		await store.checkin(plan.id, '2026-10-13');
		await store.checkin(plan.id, '2026-10-13');
		expect(store.plan(plan.id)?.progressDays).toBe(1);
	});
});

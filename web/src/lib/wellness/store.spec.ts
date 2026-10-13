import { describe, expect, it } from 'vitest';
import { MemoryWellnessStore } from './store';

describe('MemoryWellnessStore', () => {
	it('adds four cups toward the 2000 ml ring', () => {
		const store = new MemoryWellnessStore();
		for (let i = 0; i < 4; i += 1) {
			store.addWater(250, '2026-10-13');
		}
		const today = store.today('2026-10-13');
		expect(today.water.totalMl).toBe(1000);
		expect(today.water.targetMl).toBe(2000);
		expect(today.disclaimer).toContain('不构成医疗建议');
	});

	it('does not store cycles without consent', () => {
		const store = new MemoryWellnessStore();
		expect(store.cycleConsent).toBe(false);
		expect(() => store.addCycle({ startDate: '2026-08-01', symptoms: '痛经' })).toThrow(/consent/i);
		expect(store.cycles).toHaveLength(0);
		store.setCycleConsent(true);
		store.addCycle({ startDate: '2026-08-01', symptoms: '痛经' });
		expect(store.cycles).toHaveLength(1);
		store.setCycleConsent(false);
		expect(store.cycles).toHaveLength(0);
	});

	it('counts a double plan check-in as one day', () => {
		const store = new MemoryWellnessStore();
		const plan = store.createPlan('water_21');
		store.checkin(plan.id, '2026-10-13');
		store.checkin(plan.id, '2026-10-13');
		expect(store.plan(plan.id)?.progressDays).toBe(1);
	});
});

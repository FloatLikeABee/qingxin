import { describe, expect, it } from 'vitest';
import {
	addStem,
	bouquetMood,
	createFlorist,
	handAssembling,
	handWindow,
	openShop,
	putInWindow,
	scoreOffer,
	tickFlorist
} from './sim';

function drive(sim: ReturnType<typeof createFlorist>, steps: number) {
	for (let i = 0; i < steps; i++) tickFlorist(sim);
}

describe('街角花店 simulation', () => {
	it('reads a mostly 暖 bouquet as 暖', () => {
		expect(bouquetMood(['rose', 'peony', 'eucalyptus'])).toBe('暖');
		expect(bouquetMood(['lily', 'hydrangea'])).toBe('静');
		expect(bouquetMood(['tulip', 'tulip'])).toBe('亮');
	});

	it('scores a matching 暖 offer as a happy handoff', () => {
		const score = scoreOffer(['rose', 'peony', 'eucalyptus'], { mood: '暖', prefer: 'rose' }, 0, 0);
		expect(score).toBeGreaterThanOrEqual(0.5);
		const sim = createFlorist({ seed: 1, autoCustomers: false });
		addStem(sim, 'rose');
		addStem(sim, 'peony');
		openShop(sim);
		sim.guest = { id: 1, mood: '暖', prefer: 'rose', wait: 0, patience: 40 };
		expect(handAssembling(sim)).toBe(true);
		expect(sim.stats.happy).toBe(1);
	});

	it('refuses an empty hand', () => {
		const sim = createFlorist({ seed: 1, autoCustomers: false });
		openShop(sim);
		sim.guest = { id: 1, mood: '静', wait: 0, patience: 40 };
		expect(handAssembling(sim)).toBe(false);
		expect(handWindow(sim, 0)).toBe(false);
		expect(sim.stats.happy).toBe(0);
	});

	it('puts a finished bouquet into the window', () => {
		const sim = createFlorist({ seed: 2, autoCustomers: false });
		addStem(sim, 'lily');
		addStem(sim, 'hydrangea');
		expect(putInWindow(sim, 1)).toBe(true);
		expect(sim.window[1]?.stems).toEqual(['lily', 'hydrangea']);
		expect(sim.assembling).toEqual([]);
	});

	it('lets a waiting guest leave unhappy', () => {
		const sim = createFlorist({ seed: 3, autoCustomers: false, patience: 3 });
		openShop(sim);
		sim.guest = { id: 1, mood: '亮', wait: 0, patience: 3 };
		drive(sim, 5);
		expect(sim.guest).toBeNull();
		expect(sim.stats.unhappy).toBe(1);
	});
});

import { describe, expect, it } from 'vitest';
import { GOODS, totalUnits } from './goods';
import { createSim, orderCrate, restockShelf, spawnShopper, summarize, tick } from './sim';

function drive(sim: ReturnType<typeof createSim>, steps: number) {
	for (let i = 0; i < steps; i++) tick(sim);
}

describe('便利店经理 simulation', () => {
	it('restocks a shelf from storage without creating units', () => {
		const sim = createSim({
			seed: 1,
			autoSpawn: false,
			cash: 50,
			storage: { water: 5, bread: 0, milk: 0, snacks: 0, bento: 0 },
			shelfFill: 1
		});
		const before =
			totalUnits(sim.storage) + sim.shelves.reduce((sum, shelf) => sum + shelf.stock, 0);
		expect(restockShelf(sim, 0)).toBe(true);
		expect(sim.shelves[0]?.stock).toBeGreaterThan(1);
		expect(sim.storage.water).toBeLessThan(5);
		const after =
			totalUnits(sim.storage) + sim.shelves.reduce((sum, shelf) => sum + shelf.stock, 0);
		expect(after).toBe(before);
	});

	it('does not restock when storage is empty', () => {
		const sim = createSim({
			seed: 1,
			autoSpawn: false,
			storage: { water: 0, bread: 0, milk: 0, snacks: 0, bento: 0 },
			shelfFill: 2
		});
		expect(restockShelf(sim, 0)).toBe(false);
		expect(sim.shelves[0]?.stock).toBe(2);
	});

	it('lets a shopper take stocked goods and pay at checkout', () => {
		const sim = createSim({
			seed: 7,
			autoSpawn: false,
			cash: 40,
			shelfFill: 6,
			patience: 80
		});
		const shelf = sim.shelves[0];
		if (!shelf) throw new Error('missing shelf');
		const startStock = shelf.stock;
		const startCash = sim.cash;
		spawnShopper(sim, ['water']);
		drive(sim, 220);
		expect(shelf.stock).toBe(startStock - 1);
		expect(sim.cash).toBe(startCash + GOODS.water.price);
		expect(sim.stats.revenue).toBe(GOODS.water.price);
		expect(sim.stats.customersHappy).toBe(1);
		expect(sim.shoppers).toHaveLength(0);
	});

	it('marks a shopper disappointed when the listed goods are sold out', () => {
		const sim = createSim({
			seed: 3,
			autoSpawn: false,
			shelfFill: 0,
			storage: { water: 0, bread: 0, milk: 0, snacks: 0, bento: 0 },
			patience: 80
		});
		spawnShopper(sim, ['water']);
		drive(sim, 220);
		expect(sim.stats.customersUnhappy).toBe(1);
		expect(sim.stats.revenue).toBe(0);
		expect(sim.cash).toBe(createSim({ seed: 3, autoSpawn: false }).cash);
	});

	it('sends a queued shopper away unhappy after a long wait', () => {
		const sim = createSim({
			seed: 9,
			autoSpawn: false,
			shelfFill: 6,
			patience: 4,
			payTicks: 40
		});
		spawnShopper(sim, ['water']);
		spawnShopper(sim, ['bread']);
		drive(sim, 260);
		expect(sim.stats.customersUnhappy).toBeGreaterThan(0);
	});

	it('orders a crate into storage after a delay', () => {
		const sim = createSim({
			seed: 2,
			autoSpawn: false,
			cash: 40,
			storage: { water: 0, bread: 0, milk: 0, snacks: 0, bento: 0 },
			orderDelay: 5
		});
		expect(orderCrate(sim, 'water')).toBe(true);
		expect(sim.cash).toBe(40 - GOODS.water.crateCost);
		expect(sim.storage.water).toBe(0);
		drive(sim, 6);
		expect(sim.storage.water).toBe(GOODS.water.crateSize);
	});

	it('rejects an order the till cannot cover', () => {
		const sim = createSim({ seed: 2, autoSpawn: false, cash: 3 });
		expect(orderCrate(sim, 'bento')).toBe(false);
		expect(sim.cash).toBe(3);
	});

	it('starts an open shift with a shopper at the door', () => {
		const sim = createSim({ seed: 1 });
		expect(sim.shoppers).toHaveLength(1);
		expect(sim.shoppers[0]?.z).toBe(8);
	});

	it('summarizes leftover stock and satisfaction at day end', () => {
		const sim = createSim({ seed: 4, autoSpawn: false, dayTicks: 8, shelfFill: 3 });
		spawnShopper(sim, ['snacks']);
		drive(sim, 8);
		expect(sim.over).toBe(true);
		const summary = summarize(sim);
		expect(summary.leftoverUnits).toBeGreaterThan(0);
		expect(summary.cash).toBe(sim.cash);
		expect(summary.satisfaction).toBeGreaterThanOrEqual(0);
		expect(summary.satisfaction).toBeLessThanOrEqual(1);
	});
});

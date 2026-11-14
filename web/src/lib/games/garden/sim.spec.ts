import { describe, expect, it } from 'vitest';
import {
	buySeed,
	catchBug,
	clearWilt,
	createGarden,
	emergencyKit,
	harvestBed,
	isDeadlocked,
	plantSeed,
	tickGarden,
	toggleShade,
	waterBed,
	feedBed,
	type GardenState
} from './sim';

function drive(garden: GardenState, n: number) {
	for (let i = 0; i < n; i++) tickGarden(garden);
}

function growRipe(garden: GardenState, bed = 0) {
	garden.beds[bed]!.water = 3;
	garden.beds[bed]!.light = 3;
	garden.beds[bed]!.nutrient = 3;
	garden.beds[bed]!.health = 3;
	garden.beds[bed]!.bugs = [];
	drive(garden, 12 * 8);
}

describe('窗前庭园 simulation', () => {
	it('plants, waters, grows, harvests, and replants', () => {
		const garden = createGarden({ seed: 1, autoBugs: false });
		expect(plantSeed(garden, 0, 'tomato')).toBe(true);
		expect(garden.seeds.tomato).toBe(1);
		expect(garden.beds[0]?.stage).toBe('seed');
		expect(waterBed(garden, 0)).toBe(true);
		expect(feedBed(garden, 0)).toBe(true);
		growRipe(garden, 0);
		expect(garden.beds[0]?.stage).toBe('ripe');
		const coins = garden.coins;
		const harvests = garden.harvests;
		expect(harvestBed(garden, 0)).toBeGreaterThan(0);
		expect(garden.coins).toBeGreaterThan(coins);
		expect(garden.harvests).toBe(harvests + 1);
		expect(garden.beds[0]?.stage).toBe('empty');
		garden.seeds.tomato = 1;
		expect(plantSeed(garden, 0, 'tomato')).toBe(true);
		expect(garden.beds[0]?.stage).toBe('seed');
	});

	it('lets pests damage and be removed', () => {
		const garden = createGarden({ seed: 1, autoBugs: false });
		plantSeed(garden, 0, 'lettuce');
		garden.beds[0]!.bugs.push({
			id: garden.nextId++,
			kind: 'aphid',
			role: 'pest'
		});
		const health = garden.beds[0]!.health;
		drive(garden, 50);
		expect(garden.beds[0]!.health).toBeLessThan(health);
		const caught = catchBug(garden, 0, garden.beds[0]!.bugs[0]!.id);
		expect(caught).toEqual({ role: 'pest', ok: true });
		expect(garden.beds[0]!.bugs.length).toBe(0);
		expect(garden.notice).toContain('害虫');
	});

	it('lets pollinators speed growth and scolds mistaken removal', () => {
		const garden = createGarden({ seed: 2, autoBugs: false });
		plantSeed(garden, 0, 'mint');
		garden.beds[0]!.stage = 'bloom';
		garden.beds[0]!.progress = 0;
		garden.beds[0]!.water = 2;
		garden.beds[0]!.light = 2;
		garden.beds[0]!.nutrient = 1;
		garden.beds[0]!.bugs.push({ id: garden.nextId++, kind: 'bee', role: 'pollinator' });
		drive(garden, 4);
		expect(garden.beds[0]!.progress).toBeGreaterThan(4);
		const coins = garden.coins;
		const result = catchBug(garden, 0, garden.beds[0]!.bugs[0]!.id);
		expect(result.role).toBe('pollinator');
		expect(result.ok).toBe(false);
		expect(garden.notice).toContain('益虫');
		expect(garden.coins).toBeLessThan(coins);
	});

	it('keeps going after harvest with no final level', () => {
		const garden = createGarden({ seed: 3, autoBugs: false });
		plantSeed(garden, 1, 'tomato');
		growRipe(garden, 1);
		harvestBed(garden, 1);
		expect(garden.over).toBe(false);
		drive(garden, 40);
		expect(garden.over).toBe(false);
		expect(buySeed(garden, 'tomato')).toBe(true);
	});

	it('recovers from a resource deadlock', () => {
		const garden = createGarden({ seed: 4, autoBugs: false });
		garden.coins = 0;
		garden.seeds = {};
		garden.waterCan = 0;
		garden.fertilizer = 0;
		for (const bed of garden.beds) {
			bed.plantId = null;
			bed.stage = 'empty';
			bed.bugs = [];
		}
		expect(isDeadlocked(garden)).toBe(true);
		expect(emergencyKit(garden)).toBe(true);
		expect(plantSeed(garden, 0, 'tomato')).toBe(true);
		expect(isDeadlocked(garden)).toBe(false);
	});

	it('shade changes light for a bed', () => {
		const garden = createGarden({ seed: 1, autoBugs: false });
		expect(garden.beds[0]?.shade).toBe(false);
		toggleShade(garden, 0);
		expect(garden.beds[0]?.shade).toBe(true);
		expect(clearWilt(garden, 0)).toBe(false);
	});
});

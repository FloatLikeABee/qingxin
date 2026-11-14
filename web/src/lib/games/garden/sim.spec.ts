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
	pruneBed,
	repotBed,
	tickGarden,
	stepGarden,
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
	garden.bugs = [];
	drive(garden, 12 * 8);
}

function visitingPest(garden: GardenState, bedId: number, kind: 'aphid' | 'snail' | 'caterpillar') {
	const bug = {
		id: garden.nextId++,
		kind,
		role: 'pest' as const,
		bedId,
		phase: 'visit' as const,
		age: 0,
		ttl: 80
	};
	garden.bugs.push(bug);
	garden.beds[bedId]!.bugs.push(bug);
	return bug;
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

	it('lets pests arrive, visit, damage, then leave', () => {
		const garden = createGarden({ seed: 1, autoBugs: false });
		plantSeed(garden, 0, 'lettuce');
		garden.beds[0]!.stage = 'leaf';
		const bug = {
			id: garden.nextId++,
			kind: 'aphid' as const,
			role: 'pest' as const,
			bedId: 0,
			phase: 'arrive' as const,
			age: 0,
			ttl: 80
		};
		garden.bugs.push(bug);
		drive(garden, 10);
		expect(garden.bugs[0]?.phase).toBe('visit');
		expect(garden.beds[0]!.bugs.length).toBe(1);
		const health = garden.beds[0]!.health;
		drive(garden, 50);
		expect(garden.beds[0]!.health).toBeLessThan(health);
		drive(garden, 80);
		expect(garden.bugs.find((item) => item.id === bug.id)).toBeUndefined();
		expect(garden.beds[0]!.bugs.find((item) => item.id === bug.id)).toBeUndefined();
	});

	it('lets pests be removed while visiting', () => {
		const garden = createGarden({ seed: 1, autoBugs: false });
		plantSeed(garden, 0, 'lettuce');
		const bug = visitingPest(garden, 0, 'aphid');
		const caught = catchBug(garden, 0, bug.id);
		expect(caught).toEqual({ role: 'pest', ok: true });
		expect(garden.beds[0]!.bugs.length).toBe(0);
		expect(garden.bugs.length).toBe(0);
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
		const bee = {
			id: garden.nextId++,
			kind: 'bee' as const,
			role: 'pollinator' as const,
			bedId: 0,
			phase: 'visit' as const,
			age: 0,
			ttl: 40
		};
		garden.bugs.push(bee);
		garden.beds[0]!.bugs.push(bee);
		drive(garden, 4);
		expect(garden.beds[0]!.progress).toBeGreaterThan(4);
		const coins = garden.coins;
		const result = catchBug(garden, 0, bee.id);
		expect(result.role).toBe('pollinator');
		expect(result.ok).toBe(false);
		expect(garden.notice).toContain('益虫');
		expect(garden.coins).toBeLessThan(coins);
	});

	it('lets ladybugs remove aphids', () => {
		const garden = createGarden({ seed: 5, autoBugs: false });
		plantSeed(garden, 0, 'lettuce');
		garden.beds[0]!.stage = 'leaf';
		visitingPest(garden, 0, 'aphid');
		const hunter = {
			id: garden.nextId++,
			kind: 'ladybug' as const,
			role: 'predator' as const,
			bedId: 0,
			phase: 'visit' as const,
			age: 0,
			ttl: 40
		};
		garden.bugs.push(hunter);
		garden.beds[0]!.bugs.push(hunter);
		drive(garden, 16);
		expect(garden.beds[0]!.bugs.some((item) => item.kind === 'aphid')).toBe(false);
	});

	it('prunes leafy plants, refuses seedlings, and delays a second cut', () => {
		const garden = createGarden({ seed: 1, autoBugs: false });
		plantSeed(garden, 0, 'tomato');
		expect(pruneBed(garden, 0)).toBe(false);
		expect(garden.notice).toContain('剪不得');
		garden.beds[0]!.stage = 'leaf';
		garden.beds[0]!.health = 1;
		expect(pruneBed(garden, 0)).toBe(true);
		expect(garden.beds[0]!.health).toBeGreaterThan(1);
		garden.beds[0]!.progress = 8;
		expect(pruneBed(garden, 0)).toBe(true);
		expect(garden.beds[0]!.progress).toBeLessThan(8);
		expect(garden.notice).toContain('剪得太勤');
	});

	it('repots once for a harvest bonus and refuses a second pot', () => {
		const garden = createGarden({ seed: 1, autoBugs: false });
		plantSeed(garden, 0, 'tomato');
		garden.beds[0]!.stage = 'leaf';
		const coins = garden.coins;
		expect(repotBed(garden, 0)).toBe(true);
		expect(garden.coins).toBe(coins - 6);
		expect(garden.beds[0]!.potSize).toBe(2);
		expect(repotBed(garden, 0)).toBe(false);
		garden.beds[0]!.water = 3;
		garden.beds[0]!.light = 3;
		garden.beds[0]!.nutrient = 3;
		garden.beds[0]!.health = 3;
		drive(garden, 12 * 8);
		const before = garden.coins;
		const value = harvestBed(garden, 0);
		expect(value).toBeGreaterThan(14);
		expect(garden.coins).toBe(before + value);
	});

	it('caps elapsed-time stepping so a long pause cannot spiral', () => {
		const garden = createGarden({ seed: 1, autoBugs: false });
		plantSeed(garden, 0, 'mint');
		const before = garden.tick;
		stepGarden(garden, 5000);
		expect(garden.tick - before).toBeLessThanOrEqual(8);
		expect(garden.tick - before).toBeGreaterThan(0);
	});

	it('caps living bugs', () => {
		const garden = createGarden({ seed: 9, autoBugs: true });
		garden.seeds = { tomato: 12, lettuce: 12 };
		for (let i = 0; i < 12; i++) {
			plantSeed(garden, i, i % 2 === 0 ? 'tomato' : 'lettuce');
			garden.beds[i]!.stage = 'leaf';
		}
		drive(garden, 400);
		expect(garden.bugs.length).toBeLessThanOrEqual(8);
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

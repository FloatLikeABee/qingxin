import { plantById, unlockedPlants, type PlantDef } from './plants';

export const BED_COUNT = 12;
export const START_COINS = 36;
export const WATER_MAX = 12;
export const SCHEMA = 2;
export const MAX_BUGS = 8;
export const GARDEN_TICK_MS = 100;
export const REPOT_COST = 6;
export const POT_BONUS = 4;

export type Stage = 'empty' | 'seed' | 'sprout' | 'leaf' | 'bud' | 'bloom' | 'ripe' | 'wilt';
export type BugKind = 'aphid' | 'snail' | 'bee' | 'ladybug' | 'butterfly' | 'caterpillar';
export type BugRole = 'pest' | 'pollinator' | 'predator';
export type BugPhase = 'arrive' | 'visit' | 'leave';

export interface Bug {
	id: number;
	kind: BugKind;
	role: BugRole;
	bedId: number;
	phase: BugPhase;
	age: number;
	ttl: number;
}

export interface Bed {
	id: number;
	plantId: string | null;
	stage: Stage;
	progress: number;
	water: number;
	light: number;
	nutrient: number;
	health: number;
	shade: boolean;
	bugs: Bug[];
	potSize: number;
	pruned: number;
	lastPrune: number;
}

export interface GardenState {
	tick: number;
	paused: boolean;
	over: boolean;
	coins: number;
	waterCan: number;
	fertilizer: number;
	harvests: number;
	seeds: Record<string, number>;
	beds: Bed[];
	bugs: Bug[];
	notice: string;
	recovered: boolean;
	autoBugs: boolean;
	nextId: number;
	accMs: number;
	rng: () => number;
}

export interface GardenOptions {
	seed?: number;
	autoBugs?: boolean;
}

const GROW_ORDER: Stage[] = ['seed', 'sprout', 'leaf', 'bud', 'bloom', 'ripe'];

function mulberry32(seed: number): () => number {
	let t = seed >>> 0;
	return () => {
		t += 0x6d2b79f5;
		let n = t;
		n = Math.imul(n ^ (n >>> 15), n | 1);
		n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
		return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
	};
}

function needValue(need: PlantDef['water']): number {
	if (need === 'low') return 1;
	if (need === 'high') return 3;
	return 2;
}

export function roleFor(kind: BugKind): BugRole {
	if (kind === 'bee' || kind === 'butterfly') return 'pollinator';
	if (kind === 'ladybug') return 'predator';
	return 'pest';
}

export function emptyBed(id: number): Bed {
	return {
		id,
		plantId: null,
		stage: 'empty',
		progress: 0,
		water: 1,
		light: 2,
		nutrient: 1,
		health: 3,
		shade: false,
		bugs: [],
		potSize: 1,
		pruned: 0,
		lastPrune: -999
	};
}

export function createGarden(options: GardenOptions = {}): GardenState {
	return {
		tick: 0,
		paused: false,
		over: false,
		coins: START_COINS,
		waterCan: 8,
		fertilizer: 2,
		harvests: 0,
		seeds: { tomato: 2, lettuce: 2, mint: 2 },
		beds: Array.from({ length: BED_COUNT }, (_, id) => emptyBed(id)),
		bugs: [],
		notice: '先点一盆，再选种子。',
		recovered: false,
		autoBugs: options.autoBugs ?? true,
		nextId: 1,
		accMs: 0,
		rng: mulberry32(options.seed ?? 20261114)
	};
}

export function restartGarden(garden: GardenState, seed?: number) {
	Object.assign(garden, createGarden({ seed, autoBugs: garden.autoBugs }));
}

function bedAt(garden: GardenState, id: number): Bed | undefined {
	return garden.beds[id];
}

function clearBedBugs(garden: GardenState, bedId: number) {
	garden.bugs = garden.bugs.filter((bug) => bug.bedId !== bedId);
	const bed = bedAt(garden, bedId);
	if (bed) bed.bugs = [];
}

export function plantSeed(garden: GardenState, bedId: number, plantId: string): boolean {
	const bed = bedAt(garden, bedId);
	const def = plantById(plantId);
	if (!bed || !def || bed.stage !== 'empty') return false;
	if ((garden.seeds[plantId] ?? 0) < 1) return false;
	if (def.unlockAt > garden.harvests) return false;
	garden.seeds[plantId] -= 1;
	if (garden.seeds[plantId] <= 0) delete garden.seeds[plantId];
	bed.plantId = plantId;
	bed.stage = 'seed';
	bed.progress = 0;
	bed.health = 3;
	bed.potSize = 1;
	bed.pruned = 0;
	clearBedBugs(garden, bedId);
	garden.notice = `种下了${def.name}。`;
	return true;
}

export function waterBed(garden: GardenState, bedId: number): boolean {
	const bed = bedAt(garden, bedId);
	if (!bed || garden.waterCan <= 0 || bed.stage === 'empty') return false;
	garden.waterCan -= 1;
	bed.water = Math.min(3, bed.water + 1);
	garden.notice = '浇了一点水。';
	return true;
}

export function feedBed(garden: GardenState, bedId: number): boolean {
	const bed = bedAt(garden, bedId);
	if (!bed || garden.fertilizer <= 0 || bed.stage === 'empty') return false;
	garden.fertilizer -= 1;
	bed.nutrient = Math.min(3, bed.nutrient + 1);
	garden.notice = '施了一点肥。';
	return true;
}

export function toggleShade(garden: GardenState, bedId: number) {
	const bed = bedAt(garden, bedId);
	if (!bed) return;
	bed.shade = !bed.shade;
	bed.light = bed.shade ? 1 : 2;
	garden.notice = bed.shade ? '遮住了这盆光。' : '把遮荫拿开了。';
}

export function pruneBed(garden: GardenState, bedId: number): boolean {
	const bed = bedAt(garden, bedId);
	if (!bed?.plantId) return false;
	if (bed.stage !== 'leaf' && bed.stage !== 'bud' && bed.stage !== 'bloom') {
		garden.notice = '太嫩，剪不得。';
		return false;
	}
	if (bed.pruned > 0 && garden.tick - bed.lastPrune < 40) {
		bed.progress = Math.max(0, bed.progress - 6);
		bed.pruned += 1;
		bed.lastPrune = garden.tick;
		garden.notice = '剪得太勤，开花晚了。';
		return true;
	}
	bed.health = Math.min(3, bed.health + 1);
	bed.progress += 4;
	bed.pruned += 1;
	bed.lastPrune = garden.tick;
	garden.notice = '修了一枝，叶子透气了。';
	return true;
}

export function repotBed(garden: GardenState, bedId: number): boolean {
	const bed = bedAt(garden, bedId);
	if (!bed?.plantId || bed.stage === 'empty' || bed.stage === 'wilt') return false;
	if (bed.potSize >= 2) {
		garden.notice = '这盆已经够大了。';
		return false;
	}
	if (garden.coins < REPOT_COST) {
		garden.notice = '换盆要 6 收成币。';
		return false;
	}
	garden.coins -= REPOT_COST;
	bed.potSize = 2;
	bed.nutrient = Math.min(3, bed.nutrient + 1);
	garden.notice = '换了大盆，根能伸开。';
	return true;
}

export function harvestBed(garden: GardenState, bedId: number): number {
	const bed = bedAt(garden, bedId);
	const def = bed?.plantId ? plantById(bed.plantId) : undefined;
	if (!bed || !def || bed.stage !== 'ripe') return 0;
	const value = def.harvestValue + (bed.potSize >= 2 ? POT_BONUS : 0);
	garden.coins += value;
	garden.harvests += 1;
	if (garden.rng() > 0.45) {
		garden.seeds[def.id] = (garden.seeds[def.id] ?? 0) + 1;
	}
	bed.plantId = null;
	bed.stage = 'empty';
	bed.progress = 0;
	bed.health = 3;
	bed.potSize = 1;
	bed.pruned = 0;
	clearBedBugs(garden, bedId);
	garden.notice = `收成 +${value}。这是简化玩法，不是园艺建议。`;
	return value;
}

export function clearWilt(garden: GardenState, bedId: number): boolean {
	const bed = bedAt(garden, bedId);
	if (!bed || bed.stage !== 'wilt') return false;
	bed.plantId = null;
	bed.stage = 'empty';
	bed.progress = 0;
	bed.health = 3;
	bed.potSize = 1;
	clearBedBugs(garden, bedId);
	garden.notice = '清掉了枯掉的一株。';
	return true;
}

export function catchBug(
	garden: GardenState,
	bedId: number,
	bugId: number
): { role: BugRole; ok: boolean } {
	const bug = garden.bugs.find((item) => item.id === bugId && item.bedId === bedId);
	if (!bug) return { role: 'pest', ok: false };
	garden.bugs = garden.bugs.filter((item) => item.id !== bugId);
	const bed = bedAt(garden, bedId);
	if (bed) bed.bugs = bed.bugs.filter((item) => item.id !== bugId);
	if (bug.role === 'pest') {
		garden.coins += 1;
		garden.notice = '捉走了害虫，叶子松了一口气。';
		return { role: 'pest', ok: true };
	}
	garden.coins = Math.max(0, garden.coins - 2);
	garden.notice = bug.role === 'pollinator' ? '那是益虫，请留着传粉。' : '那是益虫，请留着捉虫。';
	return { role: bug.role, ok: false };
}

export function buySeed(garden: GardenState, plantId: string): boolean {
	const def = plantById(plantId);
	if (!def || def.unlockAt > garden.harvests || garden.coins < def.seedCost) return false;
	garden.coins -= def.seedCost;
	garden.seeds[plantId] = (garden.seeds[plantId] ?? 0) + 1;
	garden.notice = `买下了${def.name}种子。`;
	return true;
}

export function refillWater(garden: GardenState): boolean {
	if (garden.coins < 5 || garden.waterCan >= WATER_MAX) return false;
	garden.coins -= 5;
	garden.waterCan = Math.min(WATER_MAX, garden.waterCan + 8);
	garden.notice = '水罐满了一些。';
	return true;
}

export function buyFertilizer(garden: GardenState): boolean {
	if (garden.coins < 4) return false;
	garden.coins -= 4;
	garden.fertilizer += 1;
	garden.notice = '多了一包肥。';
	return true;
}

export function livingPlantCount(garden: GardenState): number {
	return garden.beds.filter((bed) => bed.plantId && bed.stage !== 'empty' && bed.stage !== 'wilt')
		.length;
}

export function seedCount(garden: GardenState): number {
	return Object.values(garden.seeds).reduce((sum, n) => sum + n, 0);
}

export function isDeadlocked(garden: GardenState): boolean {
	if (livingPlantCount(garden) > 0 || seedCount(garden) > 0) return false;
	const cheapest = unlockedPlants(garden.harvests).reduce(
		(min, item) => Math.min(min, item.seedCost),
		Infinity
	);
	return garden.coins < cheapest;
}

export function emergencyKit(garden: GardenState): boolean {
	if (!isDeadlocked(garden)) return false;
	garden.seeds.tomato = (garden.seeds.tomato ?? 0) + 1;
	garden.waterCan = Math.max(garden.waterCan, 6);
	garden.notice = '空园补给：一粒番茄，一点清水。';
	return true;
}

function matched(def: PlantDef, bed: Bed): boolean {
	const light = bed.shade ? 1 : bed.light;
	return (
		Math.abs(bed.water - needValue(def.water)) <= 1 &&
		Math.abs(light - needValue(def.light)) <= 1 &&
		Math.abs(bed.nutrient - needValue(def.nutrient)) <= 1
	);
}

function advanceStage(bed: Bed) {
	const index = GROW_ORDER.indexOf(bed.stage);
	if (index < 0 || index >= GROW_ORDER.length - 1) return;
	bed.stage = GROW_ORDER[index + 1] ?? 'ripe';
	bed.progress = 0;
}

function plantedBeds(garden: GardenState): Bed[] {
	return garden.beds.filter(
		(bed) => bed.plantId && bed.stage !== 'empty' && bed.stage !== 'wilt' && bed.stage !== 'seed'
	);
}

function attachVisit(garden: GardenState, bug: Bug) {
	const bed = bedAt(garden, bug.bedId);
	if (!bed) return;
	if (!bed.bugs.some((item) => item.id === bug.id)) bed.bugs.push(bug);
}

function detachBug(garden: GardenState, bug: Bug) {
	const bed = bedAt(garden, bug.bedId);
	if (bed) bed.bugs = bed.bugs.filter((item) => item.id !== bug.id);
}

function pickKind(rng: () => number): BugKind {
	const roll = rng();
	if (roll > 0.82) return 'butterfly';
	if (roll > 0.64) return 'bee';
	if (roll > 0.48) return 'ladybug';
	if (roll > 0.32) return 'snail';
	if (roll > 0.16) return 'caterpillar';
	return 'aphid';
}

function maybeSpawn(garden: GardenState) {
	if (!garden.autoBugs || garden.bugs.length >= MAX_BUGS) return;
	const hosts = plantedBeds(garden);
	if (!hosts.length || garden.rng() >= 0.028) return;
	const host = hosts[Math.floor(garden.rng() * hosts.length)];
	if (!host) return;
	const kind = pickKind(garden.rng);
	const bug: Bug = {
		id: garden.nextId++,
		kind,
		role: roleFor(kind),
		bedId: host.id,
		phase: 'arrive',
		age: 0,
		ttl: 50 + Math.floor(garden.rng() * 30)
	};
	garden.bugs.push(bug);
}

function tickBugs(garden: GardenState) {
	const hosts = plantedBeds(garden);
	for (const bug of [...garden.bugs]) {
		bug.age += 1;
		if (bug.phase === 'arrive') {
			if (bug.age >= 8) {
				bug.phase = 'visit';
				bug.age = 0;
				attachVisit(garden, bug);
			}
			continue;
		}
		if (bug.phase === 'leave') {
			if (bug.age >= 8) {
				garden.bugs = garden.bugs.filter((item) => item.id !== bug.id);
			}
			continue;
		}
		bug.ttl -= 1;
		if (hosts.length > 1 && bug.age > 0 && bug.age % 24 === 0 && garden.rng() < 0.45) {
			const next = hosts[Math.floor(garden.rng() * hosts.length)];
			if (next && next.id !== bug.bedId) {
				detachBug(garden, bug);
				bug.bedId = next.id;
				attachVisit(garden, bug);
			}
		}
		if (bug.ttl <= 0) {
			bug.phase = 'leave';
			bug.age = 0;
			detachBug(garden, bug);
		}
	}
}

export function tickGarden(garden: GardenState) {
	if (garden.paused) return;
	garden.tick += 1;
	tickBugs(garden);
	maybeSpawn(garden);
	for (const bed of garden.beds) {
		if (!bed.plantId || bed.stage === 'empty' || bed.stage === 'wilt') continue;
		const def = plantById(bed.plantId);
		if (!def) {
			bed.plantId = null;
			bed.stage = 'empty';
			continue;
		}
		if (garden.tick % 36 === 0) bed.water = Math.max(0, bed.water - 1);
		const visiting = garden.bugs.filter((bug) => bug.bedId === bed.id && bug.phase === 'visit');
		bed.bugs = visiting;
		const pests = visiting.filter((bug) => bug.role === 'pest');
		const bees = visiting.filter((bug) => bug.role === 'pollinator');
		const hunters = visiting.filter((bug) => bug.role === 'predator');
		for (const pest of pests) {
			if (pest.age > 0 && pest.age % 45 === 0) {
				bed.health = Math.max(0, bed.health - 1);
			}
		}
		if (hunters.length && pests.length && garden.tick % 12 === 0) {
			const eaten = pests[0];
			if (eaten) {
				garden.bugs = garden.bugs.filter((bug) => bug.id !== eaten.id);
				bed.bugs = bed.bugs.filter((bug) => bug.id !== eaten.id);
			}
		}
		if (bed.health <= 0) {
			bed.stage = 'wilt';
			clearBedBugs(garden, bed.id);
			garden.notice = `${def.name}枯了。`;
			continue;
		}
		if (bed.stage !== 'ripe' && matched(def, bed)) {
			bed.progress += 1 + bees.length;
			if (bed.progress >= def.stageTicks) advanceStage(bed);
		}
	}
}

export function stepGarden(garden: GardenState, elapsedMs: number) {
	if (garden.paused) return;
	const capped = Math.min(Math.max(0, elapsedMs), 250);
	garden.accMs += capped;
	let steps = 0;
	while (garden.accMs >= GARDEN_TICK_MS && steps < 8) {
		tickGarden(garden);
		garden.accMs -= GARDEN_TICK_MS;
		steps += 1;
	}
}

export function seedGardenDemo(garden: GardenState) {
	const ripe = ['tomato', 'sunflower', 'fern', 'cactus', 'grape', 'rose'] as const;
	garden.harvests = 30;
	garden.coins = 80;
	garden.waterCan = 12;
	garden.fertilizer = 6;
	for (const [index, id] of ripe.entries()) {
		const bed = garden.beds[index];
		if (!bed) continue;
		bed.plantId = id;
		bed.stage = 'ripe';
		bed.progress = 12;
		bed.water = 2;
		bed.light = 2;
		bed.nutrient = 2;
		bed.health = 3;
		bed.potSize = index === 0 ? 2 : 1;
		bed.bugs = [];
	}
	const butterfly: Bug = {
		id: garden.nextId++,
		kind: 'butterfly',
		role: 'pollinator',
		bedId: 1,
		phase: 'visit',
		age: 4,
		ttl: 90
	};
	const aphid: Bug = {
		id: garden.nextId++,
		kind: 'aphid',
		role: 'pest',
		bedId: 0,
		phase: 'visit',
		age: 6,
		ttl: 90
	};
	garden.bugs = [butterfly, aphid];
	garden.beds[1]!.bugs = [butterfly];
	garden.beds[0]!.bugs = [aphid];
	garden.notice = '演示园：几种熟株和一只路过的虫。';
}

import { plantById, unlockedPlants, type PlantDef } from './plants';

export const BED_COUNT = 12;
export const START_COINS = 36;
export const WATER_MAX = 12;
export const SCHEMA = 1;

export type Stage = 'empty' | 'seed' | 'sprout' | 'leaf' | 'bud' | 'bloom' | 'ripe' | 'wilt';
export type BugKind = 'aphid' | 'snail' | 'bee' | 'ladybug';
export type BugRole = 'pest' | 'pollinator' | 'predator';

export interface Bug {
	id: number;
	kind: BugKind;
	role: BugRole;
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
	notice: string;
	recovered: boolean;
	autoBugs: boolean;
	nextId: number;
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

function emptyBed(id: number): Bed {
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
		bugs: []
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
		notice: '先点一畦土，再选种子。',
		recovered: false,
		autoBugs: options.autoBugs ?? true,
		nextId: 1,
		rng: mulberry32(options.seed ?? 20261114)
	};
}

export function restartGarden(garden: GardenState, seed?: number) {
	Object.assign(garden, createGarden({ seed, autoBugs: garden.autoBugs }));
}

function bedAt(garden: GardenState, id: number): Bed | undefined {
	return garden.beds[id];
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
	bed.bugs = [];
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
	garden.notice = bed.shade ? '遮住了这畦光。' : '把遮荫拿开了。';
}

export function harvestBed(garden: GardenState, bedId: number): number {
	const bed = bedAt(garden, bedId);
	const def = bed?.plantId ? plantById(bed.plantId) : undefined;
	if (!bed || !def || bed.stage !== 'ripe') return 0;
	garden.coins += def.harvestValue;
	garden.harvests += 1;
	if (garden.rng() > 0.45) {
		garden.seeds[def.id] = (garden.seeds[def.id] ?? 0) + 1;
	}
	const value = def.harvestValue;
	bed.plantId = null;
	bed.stage = 'empty';
	bed.progress = 0;
	bed.bugs = [];
	bed.health = 3;
	garden.notice = `收成 +${value}。这是简化玩法，不是园艺建议。`;
	return value;
}

export function clearWilt(garden: GardenState, bedId: number): boolean {
	const bed = bedAt(garden, bedId);
	if (!bed || bed.stage !== 'wilt') return false;
	bed.plantId = null;
	bed.stage = 'empty';
	bed.progress = 0;
	bed.bugs = [];
	bed.health = 3;
	garden.notice = '清掉了枯掉的一株。';
	return true;
}

export function catchBug(
	garden: GardenState,
	bedId: number,
	bugId: number
): { role: BugRole; ok: boolean } {
	const bed = bedAt(garden, bedId);
	const bug = bed?.bugs.find((item) => item.id === bugId);
	if (!bed || !bug) return { role: 'pest', ok: false };
	bed.bugs = bed.bugs.filter((item) => item.id !== bugId);
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
		(min, plant) => Math.min(min, plant.seedCost),
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

export function tickGarden(garden: GardenState) {
	if (garden.paused) return;
	garden.tick += 1;
	for (const bed of garden.beds) {
		if (!bed.plantId || bed.stage === 'empty' || bed.stage === 'wilt') continue;
		const def = plantById(bed.plantId);
		if (!def) {
			bed.plantId = null;
			bed.stage = 'empty';
			continue;
		}
		if (garden.tick % 36 === 0) bed.water = Math.max(0, bed.water - 1);
		const pests = bed.bugs.filter((bug) => bug.role === 'pest');
		const bees = bed.bugs.filter((bug) => bug.role === 'pollinator');
		const hunters = bed.bugs.filter((bug) => bug.role === 'predator');
		if (pests.length && garden.tick % 45 === 0) {
			bed.health = Math.max(0, bed.health - 1);
		}
		if (hunters.length && pests.length && garden.tick % 12 === 0) {
			bed.bugs = bed.bugs.filter((bug) => bug.id !== pests[0]?.id);
		}
		if (bed.health <= 0) {
			bed.stage = 'wilt';
			bed.bugs = [];
			garden.notice = `${def.name}枯了。`;
			continue;
		}
		if (bed.stage !== 'ripe' && matched(def, bed)) {
			bed.progress += 1 + bees.length;
			if (bed.progress >= def.stageTicks) advanceStage(bed);
		}
		if (garden.autoBugs && bed.stage !== 'seed' && bed.bugs.length < 2 && garden.rng() < 0.018) {
			const roll = garden.rng();
			const spawn: Bug =
				roll > 0.72
					? { id: garden.nextId++, kind: 'bee', role: 'pollinator' }
					: roll > 0.5
						? { id: garden.nextId++, kind: 'ladybug', role: 'predator' }
						: roll > 0.25
							? { id: garden.nextId++, kind: 'snail', role: 'pest' }
							: { id: garden.nextId++, kind: 'aphid', role: 'pest' };
			bed.bugs.push(spawn);
		}
	}
}

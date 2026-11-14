import {
	BED_COUNT,
	createGarden,
	emptyBed,
	roleFor,
	type Bed,
	type Bug,
	type BugKind,
	type BugPhase,
	type GardenState,
	type Stage
} from './sim';
import { plantById } from './plants';

export const GARDEN_SAVE_KEY = 'qingxin.games.window-garden';
export const GARDEN_SCHEMA = 2;

const STAGES: Stage[] = ['empty', 'seed', 'sprout', 'leaf', 'bud', 'bloom', 'ripe', 'wilt'];
const KINDS: BugKind[] = ['aphid', 'snail', 'bee', 'ladybug', 'butterfly', 'caterpillar'];
const PHASES: BugPhase[] = ['arrive', 'visit', 'leave'];

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function clamp(n: unknown, min: number, max: number, fallback: number) {
	const value = Number(n);
	if (!Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, Math.round(value)));
}

function parseBug(value: unknown, nextId: { n: number }, fallbackBed: number): Bug | null {
	const rec = asRecord(value);
	if (!rec) return null;
	const kind = rec.kind;
	if (!KINDS.includes(kind as BugKind)) return null;
	const typed = kind as BugKind;
	const phase = PHASES.includes(rec.phase as BugPhase) ? (rec.phase as BugPhase) : 'visit';
	const bedId = clamp(rec.bedId, 0, BED_COUNT - 1, fallbackBed);
	return {
		id: nextId.n++,
		kind: typed,
		role: roleFor(typed),
		bedId,
		phase,
		age: clamp(rec.age, 0, 400, 0),
		ttl: clamp(rec.ttl, 1, 200, 40)
	};
}

function parseBed(value: unknown, id: number, nextId: { n: number }): Bed {
	const rec = asRecord(value);
	const fallback = emptyBed(id);
	if (!rec) return fallback;
	const plantId = typeof rec.plantId === 'string' && plantById(rec.plantId) ? rec.plantId : null;
	const stage = STAGES.includes(rec.stage as Stage) ? (rec.stage as Stage) : 'empty';
	const bugs = Array.isArray(rec.bugs)
		? rec.bugs.map((bug) => parseBug(bug, nextId, id)).filter((bug): bug is Bug => Boolean(bug))
		: [];
	return {
		id,
		plantId: plantId && stage !== 'empty' ? plantId : null,
		stage: plantId ? stage : 'empty',
		progress: clamp(rec.progress, 0, 40, 0),
		water: clamp(rec.water, 0, 3, 1),
		light: clamp(rec.light, 0, 3, 2),
		nutrient: clamp(rec.nutrient, 0, 3, 1),
		health: clamp(rec.health, 0, 3, 3),
		shade: rec.shade === true,
		bugs,
		potSize: clamp(rec.potSize, 1, 2, 1),
		pruned: clamp(rec.pruned, 0, 20, 0),
		lastPrune: clamp(rec.lastPrune, -999, 1_000_000, -999)
	};
}

export function serializeGarden(garden: GardenState) {
	return {
		schema: GARDEN_SCHEMA,
		tick: garden.tick,
		coins: garden.coins,
		waterCan: garden.waterCan,
		fertilizer: garden.fertilizer,
		harvests: garden.harvests,
		seeds: garden.seeds,
		beds: garden.beds,
		bugs: garden.bugs,
		nextId: garden.nextId
	};
}

export function writeGardenSave(
	garden: GardenState,
	storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage
) {
	try {
		storage?.setItem(GARDEN_SAVE_KEY, JSON.stringify(serializeGarden(garden)));
	} catch {
		// private mode / quota
	}
}

export function readGardenSave(
	storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage
): GardenState {
	try {
		const raw = storage?.getItem(GARDEN_SAVE_KEY);
		if (!raw) return createGarden();
		const parsed = JSON.parse(raw) as unknown;
		const rec = asRecord(parsed);
		if (!rec || (rec.schema !== 1 && rec.schema !== 2)) {
			const fresh = createGarden();
			fresh.recovered = true;
			fresh.notice = '存档读不出来，园子重新起土了。';
			return fresh;
		}
		const nextId = { n: clamp(rec.nextId, 1, 1_000_000, 1) };
		const seeds: Record<string, number> = {};
		const seedRec = asRecord(rec.seeds) ?? {};
		for (const [id, count] of Object.entries(seedRec)) {
			if (!plantById(id)) continue;
			const n = clamp(count, 0, 99, 0);
			if (n > 0) seeds[id] = n;
		}
		const listed = Array.isArray(rec.beds) ? rec.beds : [];
		const beds = Array.from({ length: BED_COUNT }, (_, id) => parseBed(listed[id], id, nextId));
		const worldBugs = Array.isArray(rec.bugs)
			? rec.bugs.map((bug) => parseBug(bug, nextId, 0)).filter((bug): bug is Bug => Boolean(bug))
			: beds.flatMap((bed) => bed.bugs);
		const garden = createGarden();
		garden.tick = clamp(rec.tick, 0, 1_000_000, 0);
		garden.coins = clamp(rec.coins, 0, 9999, 0);
		garden.waterCan = clamp(rec.waterCan, 0, 12, 0);
		garden.fertilizer = clamp(rec.fertilizer, 0, 99, 0);
		garden.harvests = clamp(rec.harvests, 0, 9999, 0);
		garden.seeds = seeds;
		garden.beds = beds;
		garden.bugs = worldBugs;
		for (const bed of garden.beds) {
			bed.bugs = garden.bugs.filter((bug) => bug.bedId === bed.id && bug.phase === 'visit');
		}
		garden.nextId = nextId.n;
		garden.recovered = false;
		garden.notice = '园子还在。';
		return garden;
	} catch {
		const fresh = createGarden();
		fresh.recovered = true;
		fresh.notice = '存档读不出来，园子重新起土了。';
		return fresh;
	}
}

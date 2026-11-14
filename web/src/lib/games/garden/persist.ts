import { BED_COUNT, createGarden, type Bed, type Bug, type GardenState, type Stage } from './sim';
import { plantById } from './plants';

export const GARDEN_SAVE_KEY = 'qingxin.games.window-garden';
export const GARDEN_SCHEMA = 1;

const STAGES: Stage[] = ['empty', 'seed', 'sprout', 'leaf', 'bud', 'bloom', 'ripe', 'wilt'];

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

function parseBug(value: unknown, nextId: { n: number }): Bug | null {
	const rec = asRecord(value);
	if (!rec) return null;
	const kind = rec.kind;
	if (kind !== 'aphid' && kind !== 'snail' && kind !== 'bee' && kind !== 'ladybug') return null;
	const role = kind === 'bee' ? 'pollinator' : kind === 'ladybug' ? 'predator' : 'pest';
	return { id: nextId.n++, kind, role };
}

function parseBed(value: unknown, id: number, nextId: { n: number }): Bed {
	const rec = asRecord(value);
	const fallback: Bed = {
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
	if (!rec) return fallback;
	const plantId = typeof rec.plantId === 'string' && plantById(rec.plantId) ? rec.plantId : null;
	const stage = STAGES.includes(rec.stage as Stage) ? (rec.stage as Stage) : 'empty';
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
		bugs: Array.isArray(rec.bugs)
			? rec.bugs.map((bug) => parseBug(bug, nextId)).filter((bug): bug is Bug => Boolean(bug))
			: []
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
		if (!rec || rec.schema !== GARDEN_SCHEMA) {
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
		const garden = createGarden();
		garden.tick = clamp(rec.tick, 0, 1_000_000, 0);
		garden.coins = clamp(rec.coins, 0, 9999, 0);
		garden.waterCan = clamp(rec.waterCan, 0, 12, 0);
		garden.fertilizer = clamp(rec.fertilizer, 0, 99, 0);
		garden.harvests = clamp(rec.harvests, 0, 9999, 0);
		garden.seeds = seeds;
		garden.beds = beds;
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

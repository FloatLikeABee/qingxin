import {
	createStudy,
	PROP_KINDS,
	PUZZLES,
	type PropKind,
	type RoomPlacement,
	type StudyPhase,
	type StudyRoom,
	type StudyWorld
} from './sim';

export const SHELF_SAVE_KEY = 'qingxin.games.memory-shelf';
export const SHELF_SCHEMA = 1;

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function clamp(n: unknown, min: number, max: number, fallback: number) {
	const value = Number(n);
	if (!Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, value));
}

const KIND_SET = new Set<string>(PROP_KINDS);
const PHASES = new Set(['observe', 'veil', 'restore', 'cleared']);

function parseKinds(raw: unknown): PropKind[] {
	if (!Array.isArray(raw)) return [];
	const out: PropKind[] = [];
	for (const item of raw) {
		const k = String(item);
		if (KIND_SET.has(k) && !out.includes(k as PropKind)) out.push(k as PropKind);
	}
	return out;
}

function parseSlots(raw: unknown, len: number): Array<PropKind | null> {
	if (!Array.isArray(raw) || raw.length !== len) return [];
	return raw.map((item) => {
		if (item == null || item === '') return null;
		const k = String(item);
		return KIND_SET.has(k) ? (k as PropKind) : null;
	});
}

function parsePlacements(raw: unknown): RoomPlacement[] {
	if (!Array.isArray(raw)) return [];
	const out: RoomPlacement[] = [];
	const seen = new Set<string>();
	for (const item of raw) {
		const rec = asRecord(item);
		if (!rec || !KIND_SET.has(String(rec.kind))) continue;
		const kind = rec.kind as PropKind;
		if (seen.has(kind)) continue;
		seen.add(kind);
		out.push({
			kind,
			x: clamp(rec.x, -2.2, 2.2, 0),
			z: clamp(rec.z, -2, 2, 0),
			yaw: clamp(rec.yaw, -6.4, 6.4, 0),
			arranged: rec.arranged === true
		});
	}
	return out;
}

export function serializeStudy(world: StudyWorld) {
	return {
		schema: SHELF_SCHEMA,
		puzzle: world.puzzle,
		phase: world.phase === 'veil' ? 'observe' : world.phase,
		room: world.room,
		slots: world.phase === 'veil' ? world.goal : world.slots,
		goal: world.goal,
		unlocked: world.unlocked,
		placements: world.placements,
		mistakes: world.mistakes,
		lowDetail: world.lowDetail,
		audioWanted: world.audioWanted,
		dockCollapsed: world.dockCollapsed
	};
}

export function writeShelfSave(
	world: StudyWorld,
	storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage
) {
	try {
		storage?.setItem(SHELF_SAVE_KEY, JSON.stringify(serializeStudy(world)));
	} catch {
		// private mode / quota
	}
}

export function readShelfSave(
	storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage
): StudyWorld {
	const fresh = createStudy();
	try {
		const raw = storage?.getItem(SHELF_SAVE_KEY);
		if (!raw) return fresh;
		const rec = asRecord(JSON.parse(raw) as unknown);
		if (!rec || rec.schema !== SHELF_SCHEMA) {
			fresh.recovered = true;
			fresh.notice = '书房的记事读不出来，货架重新摆好了。';
			return fresh;
		}
		const puzzle = clamp(rec.puzzle, 0, PUZZLES.length - 1, 0);
		fresh.puzzle = puzzle;
		const spec = PUZZLES[puzzle]!;
		const fallbackGoal = PROP_KINDS.slice(0, spec.count);
		const goal = parseKinds(rec.goal);
		fresh.goal = goal.length === spec.count ? goal : fallbackGoal;
		const slots = parseSlots(rec.slots, fresh.goal.length);
		fresh.slots = slots.length === fresh.goal.length ? slots : [...fresh.goal];
		const phase = String(rec.phase);
		fresh.phase = PHASES.has(phase) ? (phase as StudyPhase) : 'observe';
		if (fresh.phase === 'veil') fresh.phase = 'observe';
		fresh.room = rec.room === 'collection' ? 'collection' : ('study' as StudyRoom);
		fresh.unlocked = parseKinds(rec.unlocked);
		fresh.placements = parsePlacements(rec.placements);
		fresh.mistakes = clamp(rec.mistakes, 0, 99, 0);
		fresh.lowDetail = rec.lowDetail === true;
		fresh.audioWanted = rec.audioWanted === true;
		fresh.dockCollapsed = rec.dockCollapsed === true;
		fresh.recovered = false;
		if (fresh.unlocked.length > 0) {
			fresh.notice = `书房还记得你。解开 ${fresh.unlocked.length} 件收藏。`;
		}
		return fresh;
	} catch {
		fresh.recovered = true;
		fresh.notice = '书房的记事读不出来，货架重新摆好了。';
		return fresh;
	}
}

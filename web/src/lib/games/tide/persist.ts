import {
	createTide,
	STAR_COUNT,
	type CoralPatch,
	type Creature,
	type Starlight,
	type TideWorld
} from './sim';

export const TIDE_SAVE_KEY = 'qingxin.games.tide-breath';
export const TIDE_SCHEMA = 1;

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

function parseCreatures(raw: unknown, fallback: Creature[]): Creature[] {
	if (!Array.isArray(raw)) return fallback.map((c) => ({ ...c }));
	const kinds = new Set(['jelly', 'lantern', 'manta']);
	const next: Creature[] = [];
	for (const item of raw) {
		const rec = asRecord(item);
		if (!rec || !kinds.has(String(rec.kind))) continue;
		next.push({
			id: clamp(rec.id, 1, 9, next.length + 1),
			kind: rec.kind as Creature['kind'],
			x: clamp(rec.x, -7, 7, 0),
			z: clamp(rec.z, -6.5, 4.5, 0),
			heading: clamp(rec.heading, -6.3, 6.3, 0),
			speed: clamp(rec.speed, 0.4, 1.4, 0.9)
		});
	}
	return next.length === 3 ? next : fallback.map((c) => ({ ...c }));
}

function parseStars(raw: unknown, fallback: Starlight[]): Starlight[] {
	if (!Array.isArray(raw) || raw.length !== STAR_COUNT) {
		return fallback.map((s) => ({ ...s }));
	}
	return fallback.map((star, i) => {
		const rec = asRecord(raw[i]);
		return {
			...star,
			collected: rec?.collected === true
		};
	});
}

function parseCoral(raw: unknown, fallback: CoralPatch[]): CoralPatch[] {
	if (!Array.isArray(raw) || raw.length !== fallback.length) {
		return fallback.map((c) => ({ ...c }));
	}
	return fallback.map((patch, i) => {
		const rec = asRecord(raw[i]);
		const unlocked = rec?.unlocked === true;
		return {
			...patch,
			unlocked,
			growth: unlocked ? clamp(rec?.growth, 0, 1, 1) : 0
		};
	});
}

export function serializeTide(world: TideWorld) {
	return {
		schema: TIDE_SCHEMA,
		collected: world.collected,
		selected: world.selected,
		creatures: world.creatures,
		stars: world.stars.map((s) => ({ id: s.id, collected: s.collected })),
		coral: world.coral.map((c) => ({ id: c.id, unlocked: c.unlocked, growth: c.growth })),
		lowDetail: world.lowDetail,
		audioWanted: world.audioWanted,
		dockCollapsed: world.dockCollapsed
	};
}

export function writeTideSave(
	world: TideWorld,
	storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage
) {
	try {
		storage?.setItem(TIDE_SAVE_KEY, JSON.stringify(serializeTide(world)));
	} catch {
		// private mode / quota
	}
}

export function readTideSave(
	storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage
): TideWorld {
	const fresh = createTide();
	try {
		const raw = storage?.getItem(TIDE_SAVE_KEY);
		if (!raw) return fresh;
		const rec = asRecord(JSON.parse(raw) as unknown);
		if (!rec || rec.schema !== TIDE_SCHEMA) {
			fresh.recovered = true;
			fresh.notice = '潮汐存档读不出来，海面重新静下来了。';
			return fresh;
		}
		fresh.creatures = parseCreatures(rec.creatures, fresh.creatures);
		fresh.stars = parseStars(rec.stars, fresh.stars);
		fresh.coral = parseCoral(rec.coral, fresh.coral);
		fresh.collected = fresh.stars.filter((s) => s.collected).length;
		fresh.selected = clamp(rec.selected, 1, 9, 1);
		if (!fresh.creatures.some((c) => c.id === fresh.selected)) {
			fresh.selected = fresh.creatures[0]!.id;
		}
		fresh.lowDetail = rec.lowDetail === true;
		fresh.audioWanted = rec.audioWanted === true;
		fresh.dockCollapsed = rec.dockCollapsed === true;
		fresh.recovered = false;
		fresh.notice =
			fresh.collected > 0 ? `海还记得你。海光 ${fresh.collected} / ${STAR_COUNT}。` : fresh.notice;
		return fresh;
	} catch {
		fresh.recovered = true;
		fresh.notice = '潮汐存档读不出来，海面重新静下来了。';
		return fresh;
	}
}

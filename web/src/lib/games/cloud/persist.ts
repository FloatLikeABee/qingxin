import {
	CLOUD_ISLANDS,
	createSky,
	FRAG_KINDS,
	type FragKind,
	type GardenPlant,
	type SkyCreature,
	type SkyMode,
	type SkyWorld,
	type WeatherFrag
} from './sim';

export const CLOUD_SAVE_KEY = 'qingxin.games.cloud-walk';
export const CLOUD_SCHEMA = 1;

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

const FRAG_SET = new Set<string>(FRAG_KINDS);
const SKY_SET = new Set<string>(['dawn', ...FRAG_KINDS]);
const CRITTER = new Set(['puff', 'kite', 'lamb']);

function parseFragments(raw: unknown, fallback: WeatherFrag[]): WeatherFrag[] {
	if (!Array.isArray(raw) || raw.length !== fallback.length) {
		return fallback.map((f) => ({ ...f }));
	}
	return fallback.map((frag, i) => {
		const rec = asRecord(raw[i]);
		const kind = String(rec?.kind ?? frag.kind);
		return {
			...frag,
			kind: FRAG_SET.has(kind) ? (kind as FragKind) : frag.kind,
			collected: rec?.collected === true
		};
	});
}

function parseGarden(raw: unknown): GardenPlant[] {
	if (!Array.isArray(raw)) return [];
	const plants: GardenPlant[] = [];
	const seen = new Set<string>();
	for (const item of raw) {
		const rec = asRecord(item);
		if (!rec || !FRAG_SET.has(String(rec.kind))) continue;
		const kind = rec.kind as FragKind;
		if (seen.has(kind)) continue;
		seen.add(kind);
		plants.push({
			kind,
			x: clamp(rec.x, -4, 4, 0),
			z: clamp(rec.z, -4, 4, -1),
			grown: clamp(rec.grown, 0, 1, 0.4)
		});
	}
	return plants;
}

function parseCreatures(raw: unknown, fallback: SkyCreature[]): SkyCreature[] {
	if (!Array.isArray(raw)) return fallback.map((c) => ({ ...c }));
	const next: SkyCreature[] = [];
	for (const item of raw) {
		const rec = asRecord(item);
		if (!rec || !CRITTER.has(String(rec.kind))) continue;
		next.push({
			id: clamp(rec.id, 1, 9, next.length + 1),
			kind: rec.kind as SkyCreature['kind'],
			x: clamp(rec.x, -20, 40, 4),
			z: clamp(rec.z, -20, 20, -12),
			heading: clamp(rec.heading, -6.4, 6.4, 0),
			speed: clamp(rec.speed, 0.2, 1.4, 0.5),
			discovered: rec.discovered === true
		});
	}
	return next.length === 3 ? next : fallback.map((c) => ({ ...c }));
}

function parseVisited(raw: unknown): number[] {
	const ids = new Set<number>([0]);
	if (!Array.isArray(raw)) return [...ids];
	for (const item of raw) {
		const id = clamp(item, 0, CLOUD_ISLANDS.length - 1, 0);
		ids.add(id);
	}
	return [...ids];
}

export function serializeSky(world: SkyWorld) {
	return {
		schema: CLOUD_SCHEMA,
		x: world.x,
		y: world.y,
		z: world.z,
		yaw: world.yaw,
		island: world.island,
		visited: world.visited,
		didWind: world.didWind,
		didBounce: world.didBounce,
		skyMode: world.skyMode,
		fragments: world.fragments.map((f) => ({ id: f.id, kind: f.kind, collected: f.collected })),
		garden: world.garden,
		creatures: world.creatures.map((c) => ({
			id: c.id,
			kind: c.kind,
			x: c.x,
			z: c.z,
			heading: c.heading,
			speed: c.speed,
			discovered: c.discovered
		})),
		lowDetail: world.lowDetail,
		audioWanted: world.audioWanted,
		dockCollapsed: world.dockCollapsed
	};
}

export function writeSkySave(
	world: SkyWorld,
	storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage
) {
	try {
		storage?.setItem(CLOUD_SAVE_KEY, JSON.stringify(serializeSky(world)));
	} catch {
		// private mode / quota
	}
}

export function readSkySave(
	storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage
): SkyWorld {
	const fresh = createSky();
	try {
		const raw = storage?.getItem(CLOUD_SAVE_KEY);
		if (!raw) return fresh;
		const rec = asRecord(JSON.parse(raw) as unknown);
		if (!rec || rec.schema !== CLOUD_SCHEMA) {
			fresh.recovered = true;
			fresh.notice = '云上的记事读不出来，风又从头吹起。';
			return fresh;
		}
		fresh.fragments = parseFragments(rec.fragments, fresh.fragments);
		fresh.garden = parseGarden(rec.garden);
		fresh.creatures = parseCreatures(rec.creatures, fresh.creatures);
		fresh.visited = parseVisited(rec.visited);
		fresh.x = clamp(rec.x, -30, 40, 0);
		fresh.z = clamp(rec.z, -24, 24, 0);
		fresh.y = clamp(rec.y, -1, 12, 0);
		fresh.yaw = clamp(rec.yaw, -6.4, 6.4, 0);
		fresh.island = clamp(rec.island, 0, CLOUD_ISLANDS.length - 1, 0);
		if (!fresh.visited.includes(fresh.island)) fresh.visited = [...fresh.visited, fresh.island];
		fresh.didWind = rec.didWind === true;
		fresh.didBounce = rec.didBounce === true;
		const mode = String(rec.skyMode);
		fresh.skyMode = SKY_SET.has(mode) ? (mode as SkyMode) : 'dawn';
		if (
			fresh.skyMode !== 'dawn' &&
			!fresh.fragments.some((f) => f.kind === fresh.skyMode && f.collected)
		) {
			const last = fresh.fragments.find((f) => f.collected);
			fresh.skyMode = last?.kind ?? 'dawn';
		}
		fresh.lowDetail = rec.lowDetail === true;
		fresh.audioWanted = rec.audioWanted === true;
		fresh.dockCollapsed = rec.dockCollapsed === true;
		fresh.recovered = false;
		const n = fresh.fragments.filter((f) => f.collected).length;
		fresh.notice = n > 0 ? `云还记得你。天气碎片 ${n} / ${FRAG_KINDS.length}。` : fresh.notice;
		return fresh;
	} catch {
		fresh.recovered = true;
		fresh.notice = '云上的记事读不出来，风又从头吹起。';
		return fresh;
	}
}

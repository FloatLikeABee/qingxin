import { createHaul, type Biome, type HaulWorld } from './sim';

export const HAUL_SAVE_KEY = 'qingxin.games.cargo-haul';
export const HAUL_SCHEMA = 1;

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

const BIOMES = new Set<Biome>(['highway', 'city', 'country']);

function parseLog(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	return raw.map((item) => String(item).slice(0, 40)).slice(0, 12);
}

export function serializeHaul(world: HaulWorld) {
	return {
		schema: HAUL_SCHEMA,
		seed: world.seed,
		odometer: world.odometer,
		x: world.x,
		z: world.z,
		yaw: world.yaw,
		speed: world.speed,
		trailerYaw: world.trailerYaw,
		biome: world.biome,
		cargoLog: world.cargoLog.slice(0, 12),
		lowDetail: world.lowDetail,
		audioWanted: world.audioWanted,
		dockCollapsed: world.dockCollapsed,
		checkpoint: world.checkpoint
	};
}

export function writeHaulSave(
	world: HaulWorld,
	storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage
) {
	try {
		storage?.setItem(HAUL_SAVE_KEY, JSON.stringify(serializeHaul(world)));
	} catch {
		// private mode / quota
	}
}

function keepSettings(world: HaulWorld, rec: Record<string, unknown>) {
	world.lowDetail = rec.lowDetail === true;
	world.audioWanted = rec.audioWanted === true;
	world.dockCollapsed = rec.dockCollapsed === true;
}

export function readHaulSave(
	storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage
): HaulWorld {
	try {
		const raw = storage?.getItem(HAUL_SAVE_KEY);
		if (!raw) return createHaul();
		const rec = asRecord(JSON.parse(raw) as unknown);
		if (!rec || rec.schema !== HAUL_SCHEMA) {
			const fresh = createHaul();
			fresh.recovered = true;
			fresh.notice = '路书读不出来，从匝道重新起步。';
			if (rec) keepSettings(fresh, rec);
			return fresh;
		}
		const biome = BIOMES.has(String(rec.biome) as Biome) ? (rec.biome as Biome) : 'highway';
		const seed = clamp(rec.seed, 1, 1_000_000, 1);
		const x = clamp(rec.x, -80_000, 80_000, 0);
		const z = clamp(rec.z, -80_000, 80_000, 0);
		const yaw = clamp(rec.yaw, -Math.PI * 4, Math.PI * 4, 0);
		const world = createHaul(seed, { biome, x, z, yaw });
		world.x = x;
		world.z = z;
		world.yaw = yaw;
		world.odometer = clamp(rec.odometer, 0, 1e9, 0);
		world.speed = clamp(rec.speed, -8, 28, 6);
		world.trailerYaw = clamp(rec.trailerYaw, -Math.PI * 4, Math.PI * 4, yaw);
		world.cargoLog = parseLog(rec.cargoLog);
		keepSettings(world, rec);
		const cp = asRecord(rec.checkpoint);
		if (cp) {
			world.checkpoint = {
				x: clamp(cp.x, -80_000, 80_000, world.x),
				z: clamp(cp.z, -80_000, 80_000, world.z),
				yaw: clamp(cp.yaw, -Math.PI * 4, Math.PI * 4, world.yaw),
				trailerYaw: clamp(cp.trailerYaw, -Math.PI * 4, Math.PI * 4, world.trailerYaw),
				biome: BIOMES.has(String(cp.biome) as Biome) ? (cp.biome as Biome) : world.biome
			};
		}
		world.recovered = false;
		world.notice =
			world.odometer > 40
				? `路书还在。已经开了 ${(world.odometer / 1000).toFixed(1)} 公里。`
				: '方向盘转向，右脚加油，左脚刹车。车很沉，弯要提前打。';
		return world;
	} catch {
		const fresh = createHaul();
		fresh.recovered = true;
		fresh.notice = '路书读不出来，从匝道重新起步。';
		return fresh;
	}
}

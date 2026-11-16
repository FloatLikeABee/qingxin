import type { Collar, FloorId, RoleId } from './roles';
import { roleById } from './roles';
import { createWorld, type Npc, type Player, type World } from './sim';
import type { SortBox, Task, TaskStatus } from './tasks';

export const SHANGBAN_SAVE_KEY = 'qingxin.shangban';
export const SHANGBAN_SCHEMA = 1;

const STATUSES: TaskStatus[] = [
	'offered',
	'active',
	'done',
	'failed',
	'declined',
	'expired',
	'cancelled'
];

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

function recoveredWorld(notice = '存档读不出来，公司重新开门了。'): World {
	const world = createWorld({ seed: 1 });
	world.recovered = true;
	world.notice = notice;
	return world;
}

function parseFloor(value: unknown, fallback: FloorId): FloorId {
	const n = clamp(value, 1, 5, fallback);
	return (Math.round(n) as FloorId) || fallback;
}

export function serializeWorld(world: World) {
	return {
		schema: SHANGBAN_SCHEMA,
		tick: world.tick,
		seed: world.seed,
		notice: world.notice,
		player: world.player,
		company: world.company,
		tasks: world.tasks,
		packages: world.packages,
		npcs: world.npcs.map((npc) => ({
			id: npc.id,
			floor: npc.floor,
			x: npc.x,
			z: npc.z,
			homeX: npc.homeX,
			homeZ: npc.homeZ,
			phase: npc.phase,
			wait: npc.wait,
			hue: npc.hue,
			look: npc.look
		})),
		nextId: world.nextId,
		lastSpawnAt: world.lastSpawnAt,
		spawnEvery: world.spawnEvery
	};
}

export function writeShangbanSave(
	world: World,
	storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage
) {
	try {
		storage?.setItem(SHANGBAN_SAVE_KEY, JSON.stringify(serializeWorld(world)));
	} catch {
		// private mode / quota
	}
}

export function readShangbanSave(
	storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage
): World {
	try {
		const raw = storage?.getItem(SHANGBAN_SAVE_KEY);
		if (!raw) return createWorld();
		const parsed = JSON.parse(raw) as unknown;
		const rec = asRecord(parsed);
		if (!rec || rec.schema !== SHANGBAN_SCHEMA) return recoveredWorld();
		const world = createWorld({ seed: clamp(rec.seed, 1, 1_000_000_000, 1) });
		world.tick = clamp(rec.tick, 0, 1_000_000, 0);
		world.notice = typeof rec.notice === 'string' ? rec.notice : world.notice;
		world.recovered = false;
		const playerRec = asRecord(rec.player);
		if (playerRec) {
			const roleId = typeof playerRec.roleId === 'string' ? playerRec.roleId : 'courier';
			const role = roleById(roleId);
			const player: Player = {
				roleId: (role?.id ?? 'courier') as RoleId,
				floor: parseFloor(playerRec.floor, 1),
				x: clamp(playerRec.x, 0.5, 11, 2),
				z: clamp(playerRec.z, 0.5, 9, 4),
				facing: clamp(playerRec.facing, -6.3, 6.3, 0),
				pay: clamp(playerRec.pay, 0, 9999, 0),
				reputation: clamp(playerRec.reputation, 0, 100, 10),
				carrying: typeof playerRec.carrying === 'string' ? playerRec.carrying : null,
				breakUntil: clamp(playerRec.breakUntil, 0, 1_000_000, 0),
				elevatorTo: null,
				elevatorWait: 0,
				path: []
			};
			world.player = player;
		}
		const company = asRecord(rec.company);
		if (company) {
			world.company.cash = clamp(company.cash, 0, 9999, world.company.cash);
			world.company.reputation = clamp(company.reputation, 0, 100, world.company.reputation);
			world.company.morale = clamp(company.morale, 0, 100, world.company.morale);
			const deps = asRecord(company.departments);
			if (deps) {
				for (const key of ['1', '2', '3', '4', '5'] as const) {
					const row = asRecord(deps[key]);
					const floor = Number(key) as FloorId;
					if (!row) continue;
					world.company.departments[floor] = {
						workload: clamp(row.workload, 0, 100, 36),
						staff: clamp(row.staff, 1, 20, 4),
						budget: clamp(row.budget, 0, 200, 40)
					};
				}
			}
		}
		world.tasks = Array.isArray(rec.tasks)
			? rec.tasks
					.map((item) => parseTask(item))
					.filter((item): item is Task => Boolean(item))
					.slice(0, 20)
			: [];
		world.packages = Array.isArray(rec.packages)
			? rec.packages
					.map((item) => parseBox(item))
					.filter((item): item is SortBox => Boolean(item))
					.slice(0, 8)
			: [];
		if (Array.isArray(rec.npcs) && rec.npcs.length > 0) {
			world.npcs = rec.npcs
				.map((item) => parseNpc(item))
				.filter((item): item is Npc => Boolean(item))
				.slice(0, 12);
		}
		world.nextId = clamp(rec.nextId, 1, 1_000_000, world.nextId);
		world.lastSpawnAt = clamp(rec.lastSpawnAt, -999, 1_000_000, world.tick);
		world.spawnEvery = clamp(rec.spawnEvery, 1, 120, 24);
		world.paused = false;
		world.hidden = false;
		return world;
	} catch {
		return recoveredWorld();
	}
}

function parseTask(value: unknown): Task | null {
	const rec = asRecord(value);
	if (!rec) return null;
	const roleId = typeof rec.roleId === 'string' ? rec.roleId : '';
	if (!roleById(roleId)) return null;
	const status = STATUSES.includes(rec.status as TaskStatus)
		? (rec.status as TaskStatus)
		: 'offered';
	const payload = rec.payload;
	if (!payload || typeof payload !== 'object') return null;
	return {
		id: clamp(rec.id, 1, 1_000_000, 1),
		roleId: roleId as RoleId,
		kind: roleById(roleId)!.kind,
		status,
		title: typeof rec.title === 'string' ? rec.title : '工作',
		detail: typeof rec.detail === 'string' ? rec.detail : '',
		offeredAt: clamp(rec.offeredAt, 0, 1_000_000, 0),
		deadline: clamp(rec.deadline, 0, 1_000_000, 180),
		payload: payload as Task['payload'],
		resultNote: typeof rec.resultNote === 'string' ? rec.resultNote : undefined
	};
}

function parseBox(value: unknown): SortBox | null {
	const rec = asRecord(value);
	if (!rec || typeof rec.id !== 'string') return null;
	const dest = rec.dest === 'A' || rec.dest === 'B' || rec.dest === 'C' ? rec.dest : null;
	if (!dest) return null;
	return {
		id: rec.id,
		dest,
		x: clamp(rec.x, 0, 12, 3),
		z: clamp(rec.z, 0, 10, 2),
		held: rec.held === true
	};
}

const COLLARS: Collar[] = [
	'blue',
	'white',
	'specialist-blue',
	'specialist-white',
	'manager',
	'ceo'
];

function parseLook(value: unknown): Collar {
	return COLLARS.includes(value as Collar) ? (value as Collar) : 'blue';
}

function parseNpc(value: unknown): Npc | null {
	const rec = asRecord(value);
	if (!rec) return null;
	const phase = rec.phase === 'break' || rec.phase === 'walk' ? rec.phase : 'work';
	return {
		id: clamp(rec.id, 1, 1_000_000, 1),
		floor: parseFloor(rec.floor, 1),
		x: clamp(rec.x, 0, 12, 3),
		z: clamp(rec.z, 0, 10, 4),
		homeX: clamp(rec.homeX, 0, 12, 3),
		homeZ: clamp(rec.homeZ, 0, 10, 4),
		phase,
		wait: clamp(rec.wait, 0, 200, 8),
		path: [],
		hue: clamp(rec.hue, 0, 1, 0.3),
		look: parseLook(rec.look)
	};
}

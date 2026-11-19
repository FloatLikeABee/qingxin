import type { SimSpeed } from './day';
import type { DayLog } from './logs';
import type { NpcActivity } from './npc';
import type { Collar, FloorId, RoleId } from './roles';
import { roleById } from './roles';
import { createWorld, type Npc, type Player, type World } from './sim';
import {
	JOB_DURATION,
	JOB_STATION,
	checkpointsFor,
	type JobStage,
	type SortBox,
	type Task,
	type TaskStatus
} from './tasks';

export const SHANGBAN_SAVE_KEY = 'qingxin.shangban';
export const SHANGBAN_SCHEMA = 2;
const KNOWN_SCHEMAS = [1, 2];

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
		day: world.day,
		dayClosed: world.dayClosed,
		dayPayStart: world.dayPayStart,
		dayEvents: world.dayEvents,
		logs: world.logs,
		speed: world.speed,
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
			activity: npc.activity,
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
		if (!rec || !KNOWN_SCHEMAS.includes(Number(rec.schema))) return recoveredWorld();
		const world = createWorld({ seed: clamp(rec.seed, 1, 1_000_000_000, 1) });
		world.tick = clamp(rec.tick, 0, 1_000_000, 0);
		world.day = clamp(rec.day ?? 1, 1, 9999, 1);
		world.dayClosed = rec.dayClosed === true;
		world.dayPayStart = clamp(rec.dayPayStart, 0, 9999, 0);
		world.dayEvents = Array.isArray(rec.dayEvents)
			? rec.dayEvents.filter((item): item is string => typeof item === 'string').slice(-24)
			: [];
		world.logs = Array.isArray(rec.logs)
			? rec.logs.map((item) => parseLog(item)).filter((item): item is DayLog => Boolean(item))
			: [];
		world.speed = parseSpeed(rec.speed);
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
		world.paused = world.dayClosed;
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
	const kind = roleById(roleId)!.kind;
	const stage = parseStage(rec.stage, status);
	return {
		id: clamp(rec.id, 1, 1_000_000, 1),
		roleId: roleId as RoleId,
		kind,
		status,
		title: typeof rec.title === 'string' ? rec.title : '工作',
		detail: typeof rec.detail === 'string' ? rec.detail : '',
		offeredAt: clamp(rec.offeredAt, 0, 1_000_000, 0),
		deadline: clamp(rec.deadline, 0, 1_000_000, 180),
		payload: payload as Task['payload'],
		resultNote: typeof rec.resultNote === 'string' ? rec.resultNote : undefined,
		stage,
		progress: clamp(rec.progress, 0, 1, status === 'active' ? 0 : 0),
		durationTicks: clamp(rec.durationTicks, 8, 400, JOB_DURATION[roleId as RoleId]),
		ticksSpent: clamp(rec.ticksSpent, 0, 400, 0),
		payAwarded: rec.payAwarded === true,
		payGranted: clamp(rec.payGranted, 0, 999, 0),
		requiredStation:
			typeof rec.requiredStation === 'string' ? rec.requiredStation : JOB_STATION[roleId as RoleId],
		checkpoints: Array.isArray(rec.checkpoints)
			? rec.checkpoints
					.map((item) => parseCheckpoint(item))
					.filter((item): item is Task['checkpoints'][number] => Boolean(item))
			: checkpointsFor(kind)
	};
}

function parseStage(value: unknown, status: TaskStatus): JobStage {
	if (value === 'prepare' || value === 'perform' || value === 'submit' || value === 'offered') {
		return value;
	}
	if (status === 'active') return 'perform';
	if (status === 'offered') return 'offered';
	return 'submit';
}

function parseCheckpoint(value: unknown): Task['checkpoints'][number] | null {
	const rec = asRecord(value);
	if (!rec || typeof rec.id !== 'string') return null;
	return {
		id: rec.id,
		label: typeof rec.label === 'string' ? rec.label : rec.id,
		done: rec.done === true
	};
}

function parseSpeed(value: unknown): SimSpeed {
	return value === 2 || value === 3 ? value : 1;
}

function parseLog(value: unknown): DayLog | null {
	const rec = asRecord(value);
	if (!rec) return null;
	const roleId = typeof rec.roleId === 'string' ? rec.roleId : '';
	if (!roleById(roleId)) return null;
	return {
		day: clamp(rec.day, 1, 9999, 1),
		roleId: roleId as RoleId,
		closedClock: typeof rec.closedClock === 'string' ? rec.closedClock : '18:00',
		payEarned: clamp(rec.payEarned, 0, 9999, 0),
		tasks: Array.isArray(rec.tasks)
			? rec.tasks
					.map((item) => {
						const row = asRecord(item);
						if (!row || typeof row.title !== 'string') return null;
						return {
							title: row.title,
							status: STATUSES.includes(row.status as TaskStatus)
								? (row.status as TaskStatus)
								: 'done',
							ticksSpent: clamp(row.ticksSpent, 0, 400, 0),
							pay: clamp(row.pay, 0, 999, 0)
						};
					})
					.filter((item): item is DayLog['tasks'][number] => Boolean(item))
			: [],
		events: Array.isArray(rec.events)
			? rec.events.filter((item): item is string => typeof item === 'string').slice(-12)
			: [],
		unfinished: Array.isArray(rec.unfinished)
			? rec.unfinished.flatMap((item) => {
					const row = asRecord(item);
					if (!row || typeof row.title !== 'string') return [];
					return [
						{
							title: row.title,
							stage: parseStage(row.stage, 'active'),
							progress: clamp(row.progress, 0, 1, 0)
						}
					];
				})
			: []
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
	const activity = parseActivity(rec.activity);
	return {
		id: clamp(rec.id, 1, 1_000_000, 1),
		floor: parseFloor(rec.floor, 1),
		x: clamp(rec.x, 0, 12, 3),
		z: clamp(rec.z, 0, 10, 4),
		homeX: clamp(rec.homeX, 0, 12, 3),
		homeZ: clamp(rec.homeZ, 0, 10, 4),
		phase,
		activity,
		wait: clamp(rec.wait, 0, 200, 8),
		path: [],
		hue: clamp(rec.hue, 0, 1, 0.3),
		look: parseLook(rec.look)
	};
}

const ACTIVITIES: NpcActivity[] = [
	'type',
	'deliver',
	'repair',
	'meet',
	'chat',
	'coffee',
	'elevator',
	'idle'
];

function parseActivity(value: unknown): NpcActivity {
	return ACTIVITIES.includes(value as NpcActivity) ? (value as NpcActivity) : 'type';
}

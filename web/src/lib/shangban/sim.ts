import { elevatorOf, FLOORS, nearStation, pathfind, stationsOn, standFor } from './floors';
import { ROLES, type Collar, type FloorId, type RoleId } from './roles';
import { generateTask, liveQueue, type SortBox, type Task, type WorkState } from './tasks';

export const TICK_MS = 100;
export const DAY_TICKS = 600;
export const MAX_NPCS = 12;
export const NPC_COUNT = 10;
export const MAX_LIVE_TASKS = 3;
export const MAX_TASK_HISTORY = 20;
export const MAX_PACKAGES = 8;
export const ELEVATOR_TICKS = 8;
export const BREAK_TICKS = 40;
export const OFFER_TTL = 180;
export const MAX_STEP_MS = 250;
export const MAX_STEPS_PER_FRAME = 8;
export const DEFAULT_SPAWN_EVERY = 24;

export interface Player {
	roleId: RoleId;
	floor: FloorId;
	x: number;
	z: number;
	facing: number;
	pay: number;
	reputation: number;
	carrying: string | null;
	breakUntil: number;
	elevatorTo: FloorId | null;
	elevatorWait: number;
	path: { x: number; z: number }[];
}

export interface Npc {
	id: number;
	floor: FloorId;
	x: number;
	z: number;
	homeX: number;
	homeZ: number;
	phase: 'work' | 'break' | 'walk';
	wait: number;
	path: { x: number; z: number }[];
	hue: number;
	look: Collar;
}

export interface World {
	tick: number;
	notice: string;
	recovered: boolean;
	seed: number;
	paused: boolean;
	hidden: boolean;
	accMs: number;
	player: Player;
	company: WorkState['company'];
	tasks: WorkState['tasks'];
	packages: SortBox[];
	npcs: Npc[];
	nextId: number;
	lastSpawnAt: number;
	spawnEvery: number;
	mishapAt: number;
	rng: () => number;
}

export interface WorldOptions {
	seed?: number;
	spawnEvery?: number;
}

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

function dept() {
	return { workload: 36, staff: 4, budget: 40 };
}

export function clockLabel(tick: number): string {
	const t = ((tick % DAY_TICKS) + DAY_TICKS) % DAY_TICKS;
	const minutes = Math.floor((t / DAY_TICKS) * 9 * 60);
	const hour = 9 + Math.floor(minutes / 60);
	const min = minutes % 60;
	return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function clockHour(tick: number): number {
	return Number(clockLabel(tick).slice(0, 2));
}

function trimHistory(world: World) {
	if (world.tasks.length <= MAX_TASK_HISTORY) return;
	const live = world.tasks.filter((task) => task.status === 'offered' || task.status === 'active');
	const rest = world.tasks.filter((task) => task.status !== 'offered' && task.status !== 'active');
	world.tasks = [...live, ...rest.slice(-(MAX_TASK_HISTORY - live.length))];
}

export function createWorld(options: WorldOptions = {}): World {
	const seed = options.seed ?? 1;
	const rng = mulberry32(seed);
	const elevator = elevatorOf(1);
	const world: World = {
		tick: 0,
		accMs: 0,
		paused: false,
		hidden: false,
		seed,
		notice: '选岗位，走进工位做手头的活。随时换岗。',
		recovered: false,
		player: {
			roleId: 'courier',
			floor: 1,
			x: elevator.x + 1,
			z: elevator.z,
			facing: 0,
			pay: 0,
			reputation: 10,
			carrying: null,
			breakUntil: 0,
			elevatorTo: null,
			elevatorWait: 0,
			path: []
		},
		company: {
			cash: 480,
			reputation: 52,
			morale: 55,
			departments: { 1: dept(), 2: dept(), 3: dept(), 4: dept(), 5: dept() }
		},
		tasks: [],
		packages: [],
		npcs: [],
		nextId: 1,
		lastSpawnAt: -999,
		spawnEvery: options.spawnEvery ?? DEFAULT_SPAWN_EVERY,
		mishapAt: -999,
		rng
	};
	world.npcs = seedNpcs(world);
	spawnOffers(world);
	return world;
}

function seedNpcs(world: World): Npc[] {
	const npcs: Npc[] = [];
	const looks: Collar[] = ['blue', 'white', 'specialist-blue', 'specialist-white', 'manager'];
	for (const floor of FLOORS) {
		const spots = stationsOn(floor.id).filter((station) => station.kind !== 'elevator');
		for (let n = 0; n < 2; n++) {
			const station = spots[n % spots.length]!;
			const stand = standFor(station);
			npcs.push({
				id: world.nextId++,
				floor: floor.id,
				x: stand.x,
				z: stand.z,
				homeX: stand.x,
				homeZ: stand.z,
				phase: 'work',
				wait: 8 + n * 6,
				path: [],
				hue: world.rng(),
				look: looks[(floor.id + n) % looks.length]!
			});
		}
	}
	return npcs.slice(0, NPC_COUNT);
}

export function spawnOffers(world: World) {
	const live = liveQueue(world);
	if (live.length >= MAX_LIVE_TASKS) return;
	if (world.tick - world.lastSpawnAt < world.spawnEvery && world.tasks.length > 0) return;
	const task = generateTask(world.player.roleId, world.rng, world.tick, world.nextId++);
	world.tasks.push(task);
	world.lastSpawnAt = world.tick;
	if (task.payload.kind === 'sort') {
		world.packages = [...world.packages, ...task.payload.boxes].slice(-MAX_PACKAGES);
	}
	trimHistory(world);
}

export function setPaused(world: World, paused: boolean) {
	world.paused = paused;
}

export function setRole(world: World, roleId: RoleId) {
	if (world.player.roleId === roleId) return;
	const next = ROLES.find((role) => role.id === roleId);
	if (!next) return;
	for (const task of world.tasks) {
		if (task.status === 'active') task.status = 'cancelled';
		if (task.status === 'offered' && task.roleId === world.player.roleId) task.status = 'expired';
	}
	world.player.carrying = null;
	world.packages = [];
	world.player.roleId = roleId;
	world.lastSpawnAt = world.tick - world.spawnEvery;
	world.notice = `换成${next.name}。去${next.floor}楼工位。电梯在左侧。`;
	spawnOffers(world);
}

export function startBreak(world: World) {
	world.player.breakUntil = world.tick + BREAK_TICKS;
	world.notice = '歇一会儿。工位上的活还在。';
}

export function callElevator(world: World, floor: FloorId): boolean {
	if (world.player.elevatorTo != null) return false;
	if (floor === world.player.floor) {
		world.notice = '已经在这层。';
		return false;
	}
	const shaft = elevatorOf(world.player.floor);
	if (!nearStation(world.player.floor, world.player.x, world.player.z, shaft, 1.5)) {
		world.notice = '先走进电梯。';
		return false;
	}
	world.player.elevatorTo = floor;
	world.player.elevatorWait = ELEVATOR_TICKS;
	world.notice = `去${floor}楼。`;
	return true;
}

function tickElevator(world: World) {
	if (world.player.elevatorTo == null) return;
	world.player.elevatorWait -= 1;
	if (world.player.elevatorWait > 0) return;
	const dest = world.player.elevatorTo;
	const shaft = elevatorOf(dest);
	world.player.floor = dest;
	world.player.x = shaft.x + 1;
	world.player.z = shaft.z;
	world.player.elevatorTo = null;
	world.player.elevatorWait = 0;
	world.notice = `到${dest}楼。`;
}

function tickNpcs(world: World) {
	const lunch = clockHour(world.tick) === 12;
	for (const npc of world.npcs) {
		if (npc.wait > 0) {
			npc.wait -= 1;
			continue;
		}
		if (npc.path.length > 0) {
			const step = npc.path.shift();
			if (step) {
				npc.x = step.x;
				npc.z = step.z;
			}
			npc.phase = 'walk';
			if (npc.path.length === 0) {
				const br = stationsOn(npc.floor).find((station) => station.kind === 'break');
				npc.phase = br && Math.abs(npc.x - br.x) + Math.abs(npc.z - br.z) <= 1 ? 'break' : 'work';
				npc.wait = 12 + Math.floor(world.rng() * 18);
			}
			continue;
		}
		if (npc.phase === 'work' && (lunch || world.rng() < 0.05)) {
			const br = stationsOn(npc.floor).find((station) => station.kind === 'break');
			if (br) {
				npc.path = pathfind(
					npc.floor,
					{ x: Math.round(npc.x), z: Math.round(npc.z) },
					{ x: br.x, z: br.z }
				);
				npc.phase = 'walk';
			}
		} else if (npc.phase === 'break' && !lunch) {
			npc.path = pathfind(
				npc.floor,
				{ x: Math.round(npc.x), z: Math.round(npc.z) },
				{ x: npc.homeX, z: npc.homeZ }
			);
			npc.phase = 'walk';
		} else {
			npc.wait = 10;
		}
	}
}

function expireOffers(world: World) {
	for (const task of world.tasks) {
		if (task.status === 'offered' && world.tick > task.deadline) {
			task.status = 'expired';
		}
	}
}

function maybeMishap(world: World) {
	if (world.tick - world.mishapAt < 40) return;
	for (const floor of FLOORS) {
		const dept = world.company.departments[floor.id];
		if (dept.workload < 85) continue;
		dept.workload = Math.min(100, dept.workload + 4);
		world.mishapAt = world.tick;
		world.notice = `${floor.name}积压过高，出了点岔子。`;
		return;
	}
}

export function tickWorld(world: World) {
	if (world.paused || world.hidden) return;
	world.tick += 1;
	tickElevator(world);
	tickNpcs(world);
	expireOffers(world);
	spawnOffers(world);
	maybeMishap(world);
	if (world.packages.length > MAX_PACKAGES) {
		world.packages = world.packages.slice(-MAX_PACKAGES);
	}
}

export function stepWorld(world: World, elapsedMs: number) {
	if (world.paused || world.hidden) return;
	const capped = Math.min(Math.max(0, elapsedMs), MAX_STEP_MS);
	world.accMs += capped;
	let steps = 0;
	while (world.accMs >= TICK_MS && steps < MAX_STEPS_PER_FRAME) {
		tickWorld(world);
		world.accMs -= TICK_MS;
		steps += 1;
	}
}

export function restartWorld(world: World, seed = Date.now()): void {
	const next = createWorld({ seed, spawnEvery: world.spawnEvery });
	Object.assign(world, next);
}

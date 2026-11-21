export const DT_CAP = 48;
export const ROAD_POOL = 12;
export const TREE_POOL = 80;
export const BUILDING_POOL = 40;
export const CAR_POOL = 6;
export const WHEELBASE = 6.4;
export const MAX_SPEED = 26;
export const MAX_REVERSE = 7;
export const MIN_RADIUS = 18;

export type Biome = 'highway' | 'city' | 'country';
export type Gear = 'drive' | 'reverse';
export type HaulControl = 'throttle' | 'brake' | 'steer' | 'reverse' | 'handbrake';

export type Sample = { x: number; z: number; yaw: number; s: number };

export type RoadPiece = {
	id: string;
	seq: number;
	biome: Biome;
	width: number;
	length: number;
	angle: number;
	startX: number;
	startZ: number;
	startYaw: number;
	endX: number;
	endZ: number;
	endYaw: number;
	samples: Sample[];
	exits: string[];
	parentId: string | null;
	branch: 'main' | 'exit' | 'only';
	frontier: boolean;
	exitSide: 'left' | 'right' | '';
};

export type SceneryBit = {
	id: string;
	kind: 'tree' | 'building' | 'sign' | 'field';
	x: number;
	z: number;
	yaw: number;
	biome: Biome;
	pieceId: string;
};

export type DummyCar = {
	id: string;
	pieceId: string;
	s: number;
	lane: number;
	speed: number;
};

export type HaulWorld = {
	seed: number;
	seq: number;
	pieces: RoadPiece[];
	trees: SceneryBit[];
	buildings: SceneryBit[];
	cars: DummyCar[];
	x: number;
	z: number;
	yaw: number;
	speed: number;
	steer: number;
	steerInput: number;
	throttle: number;
	brake: number;
	handbrake: boolean;
	gear: Gear;
	trailerYaw: number;
	odometer: number;
	onRoad: boolean;
	biome: Biome;
	forkNearby: boolean;
	exitSide: 'left' | 'right' | '';
	along: number;
	pieceLength: number;
	notice: string;
	paused: boolean;
	lowDetail: boolean;
	reducedMotion: boolean;
	audioWanted: boolean;
	dockCollapsed: boolean;
	recovered: boolean;
	recoverCount: number;
	stuckT: number;
	t: number;
	cargoLog: string[];
	checkpoint: { x: number; z: number; yaw: number; trailerYaw: number; biome: Biome };
	freeRoad: string[];
	freeTree: string[];
	freeBuild: string[];
	freeCar: string[];
	nextRoad: number;
	nextTree: number;
	nextBuild: number;
	nextCar: number;
	rng: () => number;
};

const WIDTH: Record<Biome, number> = { highway: 16.5, city: 12.2, country: 8.8 };
const LEN: Record<Biome, number> = { highway: 92, city: 74, country: 84 };

function wrap(a: number) {
	while (a > Math.PI) a -= Math.PI * 2;
	while (a < -Math.PI) a += Math.PI * 2;
	return a;
}

function clamp(n: number, min: number, max: number) {
	return Math.min(max, Math.max(min, n));
}

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a += 0x6d2b79f5;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function nextBiome(b: Biome): Biome {
	if (b === 'highway') return 'city';
	if (b === 'city') return 'country';
	return 'highway';
}

function alloc(free: string[], prefix: string, world: HaulWorld, kind: 'road' | 'tree' | 'build' | 'car') {
	const reused = free.pop();
	if (reused) return reused;
	if (kind === 'road') {
		world.nextRoad += 1;
		return `${prefix}${world.nextRoad}`;
	}
	if (kind === 'tree') {
		world.nextTree += 1;
		return `${prefix}${world.nextTree}`;
	}
	if (kind === 'build') {
		world.nextBuild += 1;
		return `${prefix}${world.nextBuild}`;
	}
	world.nextCar += 1;
	return `${prefix}${world.nextCar}`;
}

export function minPieceRadius(piece: RoadPiece) {
	if (Math.abs(piece.angle) < 0.02) return 400;
	return piece.length / Math.abs(piece.angle);
}

export function pieceConnected(world: HaulWorld, id: string) {
	const piece = world.pieces.find((p) => p.id === id);
	if (!piece) return false;
	if (piece.frontier) return true;
	return piece.exits.some((ex) => world.pieces.some((p) => p.id === ex));
}

function fillSamples(piece: RoadPiece) {
	const n = Math.max(6, Math.ceil(piece.length / 4));
	const ds = piece.length / n;
	const k = piece.angle / piece.length;
	const samples: Sample[] = [];
	let x = piece.startX;
	let z = piece.startZ;
	let yaw = piece.startYaw;
	for (let i = 0; i <= n; i++) {
		samples.push({ x, z, yaw, s: i * ds });
		yaw += k * ds;
		x += Math.sin(yaw) * ds;
		z += Math.cos(yaw) * ds;
	}
	const last = samples[samples.length - 1]!;
	piece.samples = samples;
	piece.endX = last.x;
	piece.endZ = last.z;
	piece.endYaw = last.yaw;
}

function makePiece(
	world: HaulWorld,
	from: { x: number; z: number; yaw: number },
	biome: Biome,
	opts: { angle: number; length?: number; parentId: string | null; branch: RoadPiece['branch'] }
): RoadPiece {
	const length = opts.length ?? LEN[biome];
	const absA = Math.abs(opts.angle);
	const minR = biome === 'highway' ? 28 : biome === 'country' ? 22 : MIN_RADIUS;
	const angle = absA < 0.02 ? 0 : absA < length / minR ? opts.angle : (Math.sign(opts.angle) * length) / minR;
	const piece: RoadPiece = {
		id: alloc(world.freeRoad, 'r', world, 'road'),
		seq: world.seq,
		biome,
		width: WIDTH[biome],
		length,
		angle,
		startX: from.x,
		startZ: from.z,
		startYaw: from.yaw,
		endX: from.x,
		endZ: from.z,
		endYaw: from.yaw,
		samples: [],
		exits: [],
		parentId: opts.parentId,
		branch: opts.branch,
		frontier: true,
		exitSide: ''
	};
	world.seq += 1;
	fillSamples(piece);
	world.pieces.push(piece);
	return piece;
}

function link(parent: RoadPiece, child: RoadPiece) {
	parent.exits.push(child.id);
	parent.frontier = false;
}

function scatterScenery(world: HaulWorld, piece: RoadPiece) {
	const treeN = world.lowDetail ? 2 : piece.biome === 'city' ? 2 : 5;
	const buildN = world.lowDetail ? 1 : piece.biome === 'city' ? 4 : piece.biome === 'highway' ? 1 : 2;
	for (let i = 0; i < treeN && world.trees.length < TREE_POOL; i++) {
		const s = piece.samples[1 + Math.floor(world.rng() * (piece.samples.length - 2))]!;
		const side = world.rng() < 0.5 ? -1 : 1;
		const lat = side * (piece.width / 2 + 6 + world.rng() * 10);
		world.trees.push({
			id: alloc(world.freeTree, 't', world, 'tree'),
			kind: piece.biome === 'country' ? 'field' : 'tree',
			x: s.x + Math.cos(s.yaw) * lat,
			z: s.z - Math.sin(s.yaw) * lat,
			yaw: s.yaw,
			biome: piece.biome,
			pieceId: piece.id
		});
	}
	for (let i = 0; i < buildN && world.buildings.length < BUILDING_POOL; i++) {
		const s = piece.samples[1 + Math.floor(world.rng() * (piece.samples.length - 2))]!;
		const side = i % 2 === 0 ? 1 : -1;
		const lat = side * (piece.width / 2 + 10 + world.rng() * 8);
		world.buildings.push({
			id: alloc(world.freeBuild, 'b', world, 'build'),
			kind: piece.biome === 'city' ? 'building' : 'sign',
			x: s.x + Math.cos(s.yaw) * lat,
			z: s.z - Math.sin(s.yaw) * lat,
			yaw: s.yaw,
			biome: piece.biome,
			pieceId: piece.id
		});
	}
	if (world.cars.length < CAR_POOL && world.rng() > 0.45) {
		world.cars.push({
			id: alloc(world.freeCar, 'c', world, 'car'),
			pieceId: piece.id,
			s: 8 + world.rng() * (piece.length - 16),
			lane: world.rng() < 0.5 ? -1 : 1,
			speed: 9 + world.rng() * 6
		});
	}
}

function recyclePiece(world: HaulWorld, piece: RoadPiece) {
	world.pieces = world.pieces.filter((p) => p.id !== piece.id);
	world.freeRoad.push(piece.id);
	const dropTrees = world.trees.filter((t) => t.pieceId === piece.id);
	for (const t of dropTrees) world.freeTree.push(t.id);
	world.trees = world.trees.filter((t) => t.pieceId !== piece.id);
	const dropB = world.buildings.filter((b) => b.pieceId === piece.id);
	for (const b of dropB) world.freeBuild.push(b.id);
	world.buildings = world.buildings.filter((b) => b.pieceId !== piece.id);
	const dropC = world.cars.filter((c) => c.pieceId === piece.id);
	for (const c of dropC) world.freeCar.push(c.id);
	world.cars = world.cars.filter((c) => c.pieceId !== piece.id);
	for (const other of world.pieces) {
		other.exits = other.exits.filter((id) => id !== piece.id);
		if (other.exits.length === 0 && other.seq < piece.seq) other.frontier = true;
	}
}

export type RoadHit = {
	piece: RoadPiece;
	sample: Sample;
	lateral: number;
	along: number;
	dist: number;
};

export function projectPoint(world: HaulWorld, x: number, z: number): RoadHit | null {
	let best: RoadHit | null = null;
	for (const piece of world.pieces) {
		for (const sample of piece.samples) {
			const dx = x - sample.x;
			const dz = z - sample.z;
			const dist = dx * dx + dz * dz;
			if (best && dist >= best.dist) continue;
			const lat = dx * Math.cos(sample.yaw) - dz * Math.sin(sample.yaw);
			const along = dx * Math.sin(sample.yaw) + dz * Math.cos(sample.yaw);
			best = { piece, sample, lateral: lat, along, dist };
		}
	}
	return best;
}

function growFrom(world: HaulWorld, parent: RoadPiece) {
	if (parent.exits.length > 0) return;
	const from = { x: parent.endX, z: parent.endZ, yaw: parent.endYaw };
	const cycle = Math.floor(parent.seq / 4);
	const biome = (['highway', 'city', 'country'] as const)[cycle % 3]!;
	const fork = (parent.seq === 1 || parent.seq % 3 === 2) && parent.branch !== 'exit';
	const bend = (world.rng() - 0.5) * (biome === 'city' ? 0.72 : 0.48);
	const main = makePiece(world, from, biome, {
		angle: bend,
		parentId: parent.id,
		branch: fork ? 'main' : 'only'
	});
	link(parent, main);
	scatterScenery(world, main);
	if (fork) {
		const side: 'left' | 'right' = world.rng() < 0.5 ? 'left' : 'right';
		const exit = makePiece(world, from, nextBiome(biome), {
			angle: side === 'left' ? 0.62 : -0.62,
			length: 78,
			parentId: parent.id,
			branch: 'exit'
		});
		exit.exitSide = side;
		main.exitSide = side;
		parent.exitSide = side;
		link(parent, exit);
		scatterScenery(world, exit);
	}
}

function ensureAhead(world: HaulWorld) {
	const hit = projectPoint(world, world.x, world.z);
	const here = hit?.piece ?? world.pieces[0];
	if (!here) return;
	const queue = [here];
	const seen = new Set<string>();
	let guard = 0;
	while (queue.length && guard < 16) {
		guard += 1;
		const piece = queue.shift()!;
		if (seen.has(piece.id)) continue;
		seen.add(piece.id);
		if (piece.exits.length === 0) growFrom(world, piece);
		for (const id of piece.exits) {
			const child = world.pieces.find((p) => p.id === id);
			if (child) queue.push(child);
		}
	}
	while (world.pieces.length > ROAD_POOL) {
		const hitNow = projectPoint(world, world.x, world.z);
		const oldest = world.pieces
			.filter((p) => p.id !== hitNow?.piece.id && !p.exits.includes(hitNow?.piece.id ?? ''))
			.sort((a, b) => a.seq - b.seq)[0];
		if (!oldest) break;
		recyclePiece(world, oldest);
	}
}

export function poseOnPiece(piece: RoadPiece, s: number, lane = 0) {
	const t = clamp(s / piece.length, 0, 1);
	const idx = Math.min(piece.samples.length - 1, Math.floor(t * (piece.samples.length - 1)));
	const sample = piece.samples[idx]!;
	const lat = lane * 3.1;
	return {
		x: sample.x + Math.cos(sample.yaw) * lat,
		z: sample.z - Math.sin(sample.yaw) * lat,
		yaw: sample.yaw
	};
}

export function dummyCarPose(world: HaulWorld, car: DummyCar) {
	const piece = world.pieces.find((p) => p.id === car.pieceId);
	if (!piece) return null;
	return poseOnPiece(piece, car.s, car.lane);
}

export function haulPools(world: HaulWorld) {
	return {
		roads: world.pieces.length,
		trees: world.trees.length,
		buildings: world.buildings.length,
		cars: world.cars.length
	};
}

export function createHaul(seed = 1, opts?: { biome?: Biome; x?: number; z?: number; yaw?: number }): HaulWorld {
	const rng = mulberry32(seed);
	const world: HaulWorld = {
		seed,
		seq: 0,
		pieces: [],
		trees: [],
		buildings: [],
		cars: [],
		x: 0,
		z: 0,
		yaw: 0,
		speed: 7,
		steer: 0,
		steerInput: 0,
		throttle: 0,
		brake: 0,
		handbrake: false,
		gear: 'drive',
		trailerYaw: 0,
		odometer: 0,
		onRoad: true,
		biome: opts?.biome ?? 'highway',
		forkNearby: false,
		exitSide: '',
		along: 0,
		pieceLength: 48,
		notice: '方向盘转向，右脚加油，左脚刹车。车很沉，弯要提前打。',
		paused: false,
		lowDetail: false,
		reducedMotion: false,
		audioWanted: false,
		dockCollapsed: false,
		recovered: false,
		recoverCount: 0,
		stuckT: 0,
		t: 0,
		cargoLog: [],
		checkpoint: { x: 0, z: 8, yaw: 0, trailerYaw: 0, biome: 'highway' },
		freeRoad: [],
		freeTree: [],
		freeBuild: [],
		freeCar: [],
		nextRoad: 0,
		nextTree: 0,
		nextBuild: 0,
		nextCar: 0,
		rng
	};
	const first = makePiece(
		world,
		{ x: opts?.x ?? 0, z: opts?.z ?? 0, yaw: opts?.yaw ?? 0 },
		opts?.biome ?? 'highway',
		{ angle: 0, length: 48, parentId: null, branch: 'only' }
	);
	scatterScenery(world, first);
	const pose = poseOnPiece(first, 12);
	world.x = pose.x;
	world.z = pose.z;
	world.yaw = pose.yaw;
	world.trailerYaw = pose.yaw;
	world.checkpoint = {
		x: world.x,
		z: world.z,
		yaw: world.yaw,
		trailerYaw: world.trailerYaw,
		biome: first.biome
	};
	ensureAhead(world);
	return world;
}

export function setHaulControl(world: HaulWorld, control: HaulControl, value: number) {
	if (control === 'throttle') world.throttle = clamp(value, 0, 1);
	if (control === 'brake') world.brake = clamp(value, 0, 1);
	if (control === 'steer') world.steerInput = clamp(value, -1, 1);
	if (control === 'handbrake') world.handbrake = value > 0.5;
	if (control === 'reverse') world.gear = value > 0.5 ? 'reverse' : 'drive';
}

export function haulControlFromKeyboard(event: { key: string; code: string }): {
	move?: HaulControl;
	pause?: boolean;
	value?: number;
} {
	const key = event.key;
	if (key === 'a' || key === 'A' || key === 'ArrowLeft') return { move: 'steer', value: -1 };
	if (key === 'd' || key === 'D' || key === 'ArrowRight') return { move: 'steer', value: 1 };
	if (key === 'w' || key === 'W' || key === 'ArrowUp') return { move: 'throttle', value: 1 };
	if (key === 's' || key === 'S' || key === 'ArrowDown') return { move: 'brake', value: 1 };
	if (key === 'r' || key === 'R') return { move: 'reverse', value: 1 };
	if (key === ' ' || event.code === 'Space') return { move: 'handbrake', value: 1 };
	if (key === 'p' || key === 'P') return { pause: true };
	return {};
}

export function recoverHaul(world: HaulWorld) {
	world.x = world.checkpoint.x;
	world.z = world.checkpoint.z;
	world.yaw = world.checkpoint.yaw;
	world.trailerYaw = world.checkpoint.trailerYaw;
	world.speed = 4;
	world.steerInput = 0;
	world.throttle = 0;
	world.brake = 0;
	world.gear = 'drive';
	world.stuckT = 0;
	world.recoverCount += 1;
	world.notice = '回收到上一个路面。里程还在。';
	world.onRoad = true;
	world.biome = world.checkpoint.biome;
	ensureAhead(world);
}

function tickCars(world: HaulWorld, dt: number) {
	for (const car of world.cars) {
		car.s += car.speed * (dt / 1000);
		const piece = world.pieces.find((p) => p.id === car.pieceId);
		if (!piece) continue;
		if (car.s > piece.length) {
			const nextId = piece.exits[0];
			const next = world.pieces.find((p) => p.id === nextId);
			if (next) {
				car.pieceId = next.id;
				car.s = 2;
			} else car.s = piece.length - 2;
		}
	}
}

function tick(world: HaulWorld, dt: number) {
	const sec = dt / 1000;
	world.t += dt;
	const hit = projectPoint(world, world.x, world.z);
	const width = hit?.piece.width ?? 10;
	const lateral = hit?.lateral ?? 99;
	world.onRoad = Boolean(hit && Math.abs(lateral) < width / 2 + 1.2);
	world.biome = hit?.piece.biome ?? world.biome;
	const forkChild = hit?.piece.exits
		.map((id) => world.pieces.find((p) => p.id === id))
		.find((p) => p?.branch === 'exit');
	world.forkNearby = Boolean(forkChild) || hit?.piece.branch === 'exit';
	world.exitSide = forkChild?.exitSide || hit?.piece.exitSide || '';
	world.along = hit?.sample.s ?? 0;
	world.pieceLength = hit?.piece.length ?? 0;

	if (world.gear === 'reverse' && world.speed > 1.4) {
		world.brake = Math.max(world.brake, 0.4);
	}

	const accel = world.gear === 'reverse' ? -world.throttle * 6.2 : world.throttle * 7.4;
	world.speed += accel * sec;
	const stop = world.brake * 11 + (world.handbrake ? 14 : 0) + 1.15;
	if (world.speed > 0) world.speed = Math.max(0, world.speed - stop * sec);
	else world.speed = Math.min(0, world.speed + stop * sec);
	if (world.gear === 'reverse') world.speed = clamp(world.speed, -MAX_REVERSE, 4);
	else world.speed = clamp(world.speed, -2, MAX_SPEED);

	if (!world.onRoad) {
		world.speed *= Math.max(0, 1 - 0.55 * sec);
		world.notice = '轧到路肩了。打回路面，或等回收。';
		if (Math.abs(world.speed) < 1.4) world.stuckT += dt;
		else world.stuckT = 0;
	} else {
		world.stuckT = 0;
		if (Math.abs(world.speed) > 3) {
			world.checkpoint = {
				x: world.x,
				z: world.z,
				yaw: world.yaw,
				trailerYaw: world.trailerYaw,
				biome: world.biome
			};
		}
	}

	const jack = Math.abs(wrap(world.yaw - world.trailerYaw));
	if (Math.abs(lateral) > width / 2 + 11 || world.stuckT > 2600 || jack > 1.9) {
		recoverHaul(world);
		return;
	}

	const steerMax = 0.7 * (0.18 + 0.82 / (1 + Math.abs(world.speed) * 0.11));
	world.steer += (world.steerInput * steerMax - world.steer) * Math.min(1, 8 * sec);
	const tan = Math.tan(world.steer);
	world.yaw = wrap(world.yaw + (world.speed / WHEELBASE) * tan * sec);
	world.x += Math.sin(world.yaw) * world.speed * sec;
	world.z += Math.cos(world.yaw) * world.speed * sec;
	world.trailerYaw = wrap(
		world.trailerYaw + wrap(world.yaw - world.trailerYaw) * Math.min(1, 2.4 * sec)
	);
	world.odometer += Math.abs(world.speed) * sec;

	for (const car of world.cars) {
		const piece = world.pieces.find((p) => p.id === car.pieceId);
		if (!piece) continue;
		const pose = poseOnPiece(piece, car.s, car.lane);
		if (Math.hypot(pose.x - world.x, pose.z - world.z) < 3.6 && Math.abs(world.speed) > 7) {
			world.notice = '蹭到了旁车。';
			world.speed *= 0.45;
		}
	}

	tickCars(world, dt);
	ensureAhead(world);
}

export function stepHaul(world: HaulWorld, dt: number) {
	if (world.paused) return;
	let left = Math.max(0, dt);
	while (left > 0) {
		const slice = Math.min(DT_CAP, left);
		tick(world, slice);
		left -= slice;
	}
}

export function autoFollowHaul(world: HaulWorld, prefer: 'main' | 'exit' = 'main') {
	world.gear = 'drive';
	world.throttle = 0.85;
	world.brake = 0;
	world.handbrake = false;
	const hit = projectPoint(world, world.x, world.z);
	if (!hit) return;
	let target = hit;
	if (hit.piece.exits.length) {
		const kids = hit.piece.exits
			.map((id) => world.pieces.find((p) => p.id === id))
			.filter((p): p is RoadPiece => Boolean(p));
		const chosen =
			kids.find((p) => (prefer === 'exit' ? p.branch === 'exit' : p.branch !== 'exit')) ?? kids[0];
		if (chosen && hit.sample.s > hit.piece.length - 18) {
			const s0 = chosen.samples[0]!;
			target = {
				piece: chosen,
				sample: s0,
				lateral: 0,
				along: 0,
				dist: 0
			};
		}
	}
	const yawErr = wrap(target.sample.yaw - world.yaw);
	world.steerInput = clamp(-target.lateral * 0.12 - yawErr * 1.6, -1, 1);
}

export function generateHaulMeters(world: HaulWorld, meters: number) {
	let left = meters;
	let guard = 0;
	while (left > 0 && guard < 20_000) {
		guard += 1;
		ensureAhead(world);
		const hit = projectPoint(world, world.x, world.z);
		const piece = hit?.piece ?? world.pieces[0];
		if (!piece) break;
		const step = Math.min(left, piece.length * 0.85);
		const pose = poseOnPiece(piece, Math.min(piece.length - 2, (hit?.sample.s ?? 0) + step));
		world.x = pose.x;
		world.z = pose.z;
		world.yaw = pose.yaw;
		world.trailerYaw = pose.yaw;
		world.odometer += step;
		left -= step;
		if (piece.exits.length === 0) growFrom(world, piece);
		const kids = piece.exits
			.map((id) => world.pieces.find((p) => p.id === id))
			.filter((p): p is RoadPiece => Boolean(p));
		const next = kids.find((p) => p.branch !== 'exit') ?? kids[0];
		if (next && (hit?.sample.s ?? 0) + step > piece.length - 8) {
			const start = next.samples[1] ?? next.samples[0]!;
			world.x = start.x;
			world.z = start.z;
			world.yaw = start.yaw;
		}
		ensureAhead(world);
	}
}

export function simulateHaulMeters(world: HaulWorld, meters: number) {
	generateHaulMeters(world, meters);
	autoFollowHaul(world, 'main');
	stepHaul(world, 240);
}

export function restartHaul(world: HaulWorld) {
	const next = createHaul(world.seed);
	next.lowDetail = world.lowDetail;
	next.audioWanted = world.audioWanted;
	next.dockCollapsed = world.dockCollapsed;
	Object.assign(world, next);
}

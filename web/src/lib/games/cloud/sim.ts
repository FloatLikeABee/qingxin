export const FRAG_KINDS = ['sun', 'rain', 'breeze', 'night'] as const;
export type FragKind = (typeof FRAG_KINDS)[number];
export type SkyMode = 'dawn' | FragKind;
export type BiomeId = 'garden' | 'alien' | 'city' | 'water' | 'underworld';

export type Island = {
	id: number;
	name: string;
	x: number;
	z: number;
	y: number;
	r: number;
};

export type CloudPad = {
	id: string;
	x: number;
	z: number;
	y: number;
	r: number;
};

export type WeatherFrag = {
	id: number;
	kind: FragKind;
	x: number;
	y: number;
	z: number;
	collected: boolean;
};

export type GardenPlant = {
	kind: FragKind;
	x: number;
	z: number;
	grown: number;
};

export type SkyCreature = {
	id: number;
	kind: 'puff' | 'kite' | 'lamb';
	x: number;
	z: number;
	heading: number;
	speed: number;
	discovered: boolean;
};

export type SkyKeys = {
	up: boolean;
	down: boolean;
	left: boolean;
	right: boolean;
	rise: boolean;
	dive: boolean;
};

export type SkyWorld = {
	x: number;
	y: number;
	z: number;
	vx: number;
	vy: number;
	vz: number;
	yaw: number;
	lookX: number;
	lookZ: number;
	onGround: boolean;
	inWind: boolean;
	airborne: boolean;
	island: number;
	biome: BiomeId;
	bound: boolean;
	boundTimer: number;
	visited: number[];
	biomes: BiomeId[];
	didWind: boolean;
	didBounce: boolean;
	bounceCool: number;
	bounceVx: number;
	bounceVz: number;
	skyMode: SkyMode;
	recovered: boolean;
	audioWanted: boolean;
	dockCollapsed: boolean;
	islands: Island[];
	clouds: CloudPad[];
	fragments: WeatherFrag[];
	garden: GardenPlant[];
	creatures: SkyCreature[];
	keys: SkyKeys;
	steer: { x: number; y: number; z: number } | null;
	paused: boolean;
	lowDetail: boolean;
	reducedMotion: boolean;
	soundOn: boolean;
	notice: string;
	t: number;
	over: boolean;
};

export const WORLD_R = 42;
export const Y_MIN = -14;
export const Y_MAX = 18;
export const HOME = { x: 0, y: 1, z: 0 };
export const WELL = { x: 0.2, y: 0, z: -0.55, r: 2.2 };
export const FLY = 0.0042;
export const DIVE = 0.0028;
export const RECALL_MS = 1600;

export const WIND_TUBE = {
	ax: 2.75,
	ay: 0.32,
	az: 0.08,
	bx: 10.7,
	by: 1.32,
	bz: 0.32,
	r: 1.22
};

export const CLOUD_ISLANDS: Island[] = [
	{ id: 0, name: 'home', x: 0, z: 0, y: 0, r: 3.6 },
	{ id: 1, name: 'sun terrace', x: 12, z: 0.4, y: 1.15, r: 2.6 },
	{ id: 2, name: 'rain meadow', x: 22.5, z: 1.2, y: 0.45, r: 3.1 },
	{ id: 3, name: 'creature isle', x: 4.5, z: -12, y: 0.7, r: 3.4 }
];

const CLOUDS: CloudPad[] = [
	{ id: 'c1', x: 15.55, z: 0.7, y: 0.88, r: 1.58 },
	{ id: 'c2', x: 18.9, z: 1.0, y: 1.12, r: 1.48 }
];

export const GARDEN_PLOTS: Record<FragKind, { x: number; z: number }> = {
	sun: { x: -1.45, z: -1.65 },
	rain: { x: 0.25, z: -2.05 },
	breeze: { x: 1.55, z: -1.45 },
	night: { x: 0.05, z: -0.72 }
};

const COLLECT_R = 1.18;
const DT_CAP = 48;
const ISLAND_FROM_BIOME: Record<BiomeId, number> = {
	garden: 0,
	alien: 1,
	city: 3,
	water: 0,
	underworld: 0
};

export function biomeAt(x: number, y: number, z: number): BiomeId {
	if (y < -6) return 'underworld';
	const well = Math.hypot(x - WELL.x, z - WELL.z);
	if (y < 0.15 && well < 9) return 'water';
	if (x >= 8 && x <= 30 && z >= -10 && z <= 14 && y >= -0.5 && y <= 9) return 'alien';
	if (x >= -10 && x <= 20 && z >= -30 && z <= -6 && y >= 2 && y <= 16) return 'city';
	return 'garden';
}

export function mapVisitedToBiomes(ids: number[]): BiomeId[] {
	const out = new Set<BiomeId>(['garden']);
	for (const id of ids) {
		if (id === 1 || id === 2) out.add('alien');
		else if (id === 3) out.add('city');
		else out.add('garden');
	}
	return [...out];
}

function hypot2(dx: number, dz: number) {
	return Math.hypot(dx, dz);
}

function windT(x: number, y: number, z: number) {
	const dx = WIND_TUBE.bx - WIND_TUBE.ax;
	const dy = WIND_TUBE.by - WIND_TUBE.ay;
	const dz = WIND_TUBE.bz - WIND_TUBE.az;
	const len2 = dx * dx + dy * dy + dz * dz;
	const t = ((x - WIND_TUBE.ax) * dx + (y - WIND_TUBE.ay) * dy + (z - WIND_TUBE.az) * dz) / len2;
	return Math.min(1, Math.max(0, t));
}

function inWindTube(x: number, y: number, z: number) {
	const t = windT(x, y, z);
	const px = WIND_TUBE.ax + (WIND_TUBE.bx - WIND_TUBE.ax) * t;
	const py = WIND_TUBE.ay + (WIND_TUBE.by - WIND_TUBE.ay) * t;
	const pz = WIND_TUBE.az + (WIND_TUBE.bz - WIND_TUBE.az) * t;
	return Math.hypot(x - px, y - py, z - pz) <= WIND_TUBE.r;
}

function growGarden(world: SkyWorld, kind: FragKind) {
	if (world.garden.some((p) => p.kind === kind)) return;
	const plot = GARDEN_PLOTS[kind];
	world.garden = [...world.garden, { kind, x: plot.x, z: plot.z, grown: 0.08 }];
}

function markBiome(world: SkyWorld, biome: BiomeId) {
	if (!world.biomes.includes(biome)) world.biomes = [...world.biomes, biome];
	const id = ISLAND_FROM_BIOME[biome];
	if (!world.visited.includes(id)) world.visited = [...world.visited, id];
}

export function createSky(): SkyWorld {
	const yaw = 1.18;
	return {
		x: HOME.x,
		y: HOME.y,
		z: HOME.z,
		vx: 0,
		vy: 0,
		vz: 0,
		yaw,
		lookX: Math.sin(yaw),
		lookZ: Math.cos(yaw),
		onGround: false,
		inWind: false,
		airborne: true,
		island: 0,
		biome: 'garden',
		bound: false,
		boundTimer: 0,
		visited: [0],
		biomes: ['garden'],
		didWind: false,
		didBounce: false,
		bounceCool: 0,
		bounceVx: 0,
		bounceVz: 0,
		skyMode: 'dawn',
		recovered: false,
		audioWanted: false,
		dockCollapsed: false,
		islands: CLOUD_ISLANDS.map((i) => ({ ...i })),
		clouds: CLOUDS.map((c) => ({ ...c })),
		fragments: [
			{ id: 1, kind: 'sun', x: 12.15, y: 2.4, z: 0.48, collected: false },
			{ id: 2, kind: 'rain', x: 22.35, y: 1.8, z: 1.15, collected: false },
			{ id: 3, kind: 'breeze', x: 8.2, y: 8.4, z: -18.2, collected: false },
			{ id: 4, kind: 'night', x: 0.8, y: -9.2, z: -1.2, collected: false }
		],
		garden: [],
		creatures: [
			{ id: 1, kind: 'puff', x: 1.4, z: -2.2, heading: 0.4, speed: 0.55, discovered: false },
			{ id: 2, kind: 'kite', x: 6.2, z: -8.6, heading: 2.1, speed: 0.72, discovered: false },
			{ id: 3, kind: 'lamb', x: 3.5, z: -12.8, heading: 4.0, speed: 0.42, discovered: false }
		],
		keys: { up: false, down: false, left: false, right: false, rise: false, dive: false },
		steer: null,
		paused: false,
		lowDetail: false,
		reducedMotion: false,
		soundOn: false,
		notice: '按住飞升或潜入。云界连成一片，没有门。',
		t: 0,
		over: false
	};
}

export function setSkyKey(world: SkyWorld, key: keyof SkyKeys, down: boolean) {
	world.keys[key] = down;
}

export function setSkyLook(world: SkyWorld, x: number, z: number) {
	const len = Math.hypot(x, z) || 1;
	world.lookX = x / len;
	world.lookZ = z / len;
}

export function setSkySteer(world: SkyWorld, x: number, y: number | null, z?: number) {
	if (y === null || z == null) {
		world.steer = null;
		return;
	}
	world.steer = { x, y, z };
}

export function recallHome(world: SkyWorld) {
	world.x = HOME.x;
	world.y = HOME.y;
	world.z = HOME.z;
	world.vx = 0;
	world.vy = 0;
	world.vz = 0;
	world.steer = null;
	world.keys = { up: false, down: false, left: false, right: false, rise: false, dive: false };
	world.bound = false;
	world.boundTimer = 0;
	world.biome = 'garden';
	world.island = 0;
	world.notice = '云界的边把你轻轻送回家。';
}

export function collectNear(world: SkyWorld) {
	for (const frag of world.fragments) {
		if (frag.collected) continue;
		if (Math.hypot(world.x - frag.x, world.y - frag.y, world.z - frag.z) > COLLECT_R) continue;
		frag.collected = true;
		world.skyMode = frag.kind;
		growGarden(world, frag.kind);
		world.notice =
			frag.kind === 'sun'
				? '阳光碎片落进云圃。'
				: frag.kind === 'rain'
					? '雨丝让云圃发芽。'
					: frag.kind === 'breeze'
						? '微风绕过新叶子。'
						: '夜色在潜界里亮起来。';
	}
}

function wish(world: SkyWorld) {
	let wx = 0;
	let wy = 0;
	let wz = 0;
	const lx = world.lookX;
	const lz = world.lookZ;
	const rx = lz;
	const rz = -lx;
	if (world.keys.up) {
		wx += lx;
		wz += lz;
	}
	if (world.keys.down) {
		wx -= lx;
		wz -= lz;
	}
	if (world.keys.right) {
		wx += rx;
		wz += rz;
	}
	if (world.keys.left) {
		wx -= rx;
		wz -= rz;
	}
	if (world.keys.rise) wy += 1;
	if (world.keys.dive) wy -= 1;
	if (world.steer) {
		const dx = world.steer.x - world.x;
		const dy = world.steer.y - world.y;
		const dz = world.steer.z - world.z;
		if (Math.hypot(dx, dy, dz) > 0.35) {
			wx += dx;
			wy += dy;
			wz += dz;
		} else {
			world.steer = null;
		}
	}
	const len = Math.hypot(wx, wy, wz);
	if (len < 0.001) return { x: 0, y: 0, z: 0 };
	return { x: wx / len, y: wy / len, z: wz / len };
}

function moveCreatures(world: SkyWorld, dt: number) {
	for (const c of world.creatures) {
		c.heading += (Math.sin(world.t * 0.0004 + c.id) * 0.0018 + 0.0004) * dt;
		c.x += Math.cos(c.heading) * c.speed * 0.0011 * dt;
		c.z += Math.sin(c.heading) * c.speed * 0.0011 * dt;
		const dHome = hypot2(c.x, c.z);
		if (dHome > 22) {
			c.heading += Math.PI * 0.55;
			c.x *= 0.92;
			c.z *= 0.92;
		}
		if (!c.discovered && Math.hypot(world.x - c.x, world.y - 1, world.z - c.z) < 2.6) {
			c.discovered = true;
			world.notice =
				c.kind === 'puff'
					? '一团小云停下来看你。'
					: c.kind === 'kite'
						? '风筝鸟贴着气流滑过。'
						: '云羊在软草上打滚。';
		}
	}
}

function applyBound(world: SkyWorld, dt: number) {
	const r = hypot2(world.x, world.z);
	world.bound = r >= 38 || world.y > 16.2 || world.y < -12.4;
	if (r > 38) {
		const t = Math.min(1, (r - 38) / 4);
		const push = t * 0.005 * dt;
		const nx = world.x / (r || 1);
		const nz = world.z / (r || 1);
		world.x -= nx * push;
		world.z -= nz * push;
	}
	if (world.y > 17) world.y -= (world.y - 17) * 0.08;
	if (world.y < -13) world.y += (-13 - world.y) * 0.08;
	const nr = hypot2(world.x, world.z);
	if (nr > WORLD_R) {
		const scale = WORLD_R / nr;
		world.x *= scale;
		world.z *= scale;
	}
	world.y = Math.min(Y_MAX, Math.max(Y_MIN, world.y));
	const rim = hypot2(world.x, world.z) >= 40 || world.y >= Y_MAX - 0.05 || world.y <= Y_MIN + 0.05;
	if (rim) world.boundTimer += dt;
	else world.boundTimer = 0;
	if (world.boundTimer >= RECALL_MS) recallHome(world);
}

function tick(world: SkyWorld, dt: number) {
	world.t += dt;
	world.over = false;
	for (const plant of world.garden) {
		plant.grown = Math.min(1, plant.grown + dt * 0.00055);
	}

	const dir = wish(world);
	const wet = world.biome === 'water' || world.biome === 'underworld';
	const speed = wet ? DIVE : FLY;
	const tubeT = windT(world.x, world.y + 0.4, world.z);
	const inTube = inWindTube(world.x, world.y + 0.4, world.z) && tubeT < 0.94;
	world.inWind = inTube;
	if (inTube && !world.keys.rise && !world.keys.dive && !dir.x && !dir.z) {
		world.didWind = true;
		const dx = WIND_TUBE.bx - WIND_TUBE.ax;
		const dy = WIND_TUBE.by - WIND_TUBE.ay;
		const dz = WIND_TUBE.bz - WIND_TUBE.az;
		const len = Math.hypot(dx, dy, dz) || 1;
		world.x += (dx / len) * 0.0076 * dt;
		world.y += (dy / len) * 0.0076 * dt;
		world.z += (dz / len) * 0.0076 * dt;
	} else {
		world.x += dir.x * speed * dt;
		world.y += dir.y * speed * dt;
		world.z += dir.z * speed * dt;
	}
	if (dir.x || dir.z) world.yaw = Math.atan2(dir.x, dir.z);
	world.airborne = true;
	world.onGround = false;
	world.biome = biomeAt(world.x, world.y, world.z);
	world.island = ISLAND_FROM_BIOME[world.biome];
	markBiome(world, world.biome);
	applyBound(world, dt);
	collectNear(world);
	moveCreatures(world, dt);
}

export function stepSky(world: SkyWorld, dt: number) {
	if (world.paused) return;
	let left = Math.max(0, dt);
	while (left > 0) {
		const slice = Math.min(DT_CAP, left);
		tick(world, slice);
		left -= slice;
	}
}

export function moveWalker(world: SkyWorld, x: number, z: number) {
	world.x = x;
	world.z = z;
}

export function collectFragment(world: SkyWorld, kind: FragKind) {
	const frag = world.fragments.find((f) => f.kind === kind);
	if (!frag) return;
	world.x = frag.x;
	world.y = frag.y;
	world.z = frag.z;
	collectNear(world);
	world.biome = biomeAt(world.x, world.y, world.z);
	world.island = ISLAND_FROM_BIOME[world.biome];
	markBiome(world, world.biome);
}

export function restartSky(world: SkyWorld) {
	const next = createSky();
	next.lowDetail = world.lowDetail;
	next.audioWanted = world.audioWanted;
	next.dockCollapsed = world.dockCollapsed;
	Object.assign(world, next);
}

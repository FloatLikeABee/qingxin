export const FRAG_KINDS = ['sun', 'rain', 'breeze', 'night'] as const;
export type FragKind = (typeof FRAG_KINDS)[number];
export type SkyMode = 'dawn' | FragKind;

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
};

export type SkyWorld = {
	x: number;
	y: number;
	z: number;
	vx: number;
	vy: number;
	vz: number;
	yaw: number;
	onGround: boolean;
	inWind: boolean;
	airborne: boolean;
	island: number;
	visited: number[];
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
	steer: { x: number; z: number } | null;
	paused: boolean;
	lowDetail: boolean;
	reducedMotion: boolean;
	soundOn: boolean;
	notice: string;
	t: number;
	over: boolean;
};

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

const WIND = WIND_TUBE;

const PLOTS: Record<FragKind, { x: number; z: number }> = {
	sun: { x: -1.45, z: -1.65 },
	rain: { x: 0.25, z: -2.05 },
	breeze: { x: 1.55, z: -1.45 },
	night: { x: 0.05, z: -0.72 }
};

const WALK = 0.00355;
const AIR = 0.00135;
const WIND_SPEED = 0.0076;
const GRAVITY = 0.000028;
const JUMP = 0.0118;
const BOUNCE_VY = 0.0106;
const BOUNCE_VX = 0.0074;
const COLLECT_R = 1.18;
const DT_CAP = 48;

function hypot2(dx: number, dz: number) {
	return Math.hypot(dx, dz);
}

function nearestIsland(world: SkyWorld): Island | null {
	let best: Island | null = null;
	let bestD = Infinity;
	for (const isle of world.islands) {
		const d = hypot2(world.x - isle.x, world.z - isle.z);
		if (d <= isle.r + 0.12 && d < bestD) {
			best = isle;
			bestD = d;
		}
	}
	return best;
}

function onIslandPad(world: SkyWorld, isle: Island) {
	return (
		hypot2(world.x - isle.x, world.z - isle.z) <= isle.r &&
		world.y <= isle.y + 0.55 &&
		world.y >= isle.y - 0.22
	);
}

function windT(x: number, y: number, z: number) {
	const dx = WIND.bx - WIND.ax;
	const dy = WIND.by - WIND.ay;
	const dz = WIND.bz - WIND.az;
	const len2 = dx * dx + dy * dy + dz * dz;
	const t = ((x - WIND.ax) * dx + (y - WIND.ay) * dy + (z - WIND.az) * dz) / len2;
	return Math.min(1, Math.max(0, t));
}

function inWindTube(x: number, y: number, z: number) {
	const t = windT(x, y, z);
	const px = WIND.ax + (WIND.bx - WIND.ax) * t;
	const py = WIND.ay + (WIND.by - WIND.ay) * t;
	const pz = WIND.az + (WIND.bz - WIND.az) * t;
	return Math.hypot(x - px, y - py, z - pz) <= WIND.r;
}

function growGarden(world: SkyWorld, kind: FragKind) {
	if (world.garden.some((p) => p.kind === kind)) return;
	const plot = PLOTS[kind];
	world.garden = [...world.garden, { kind, x: plot.x, z: plot.z, grown: 0.08 }];
}

function markVisit(world: SkyWorld, id: number) {
	if (world.visited.includes(id)) return;
	world.visited = [...world.visited, id];
}

export function createSky(): SkyWorld {
	return {
		x: 0,
		y: 0,
		z: 0,
		vx: 0,
		vy: 0,
		vz: 0,
		yaw: 1.18,
		onGround: true,
		inWind: false,
		airborne: false,
		island: 0,
		visited: [0],
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
			{ id: 1, kind: 'sun', x: 12.15, y: 1.42, z: 0.48, collected: false },
			{ id: 2, kind: 'rain', x: 22.35, y: 0.72, z: 1.15, collected: false },
			{ id: 3, kind: 'breeze', x: 3.55, y: 0.98, z: -11.15, collected: false },
			{ id: 4, kind: 'night', x: 5.55, y: 0.98, z: -13.05, collected: false }
		],
		garden: [],
		creatures: [
			{ id: 1, kind: 'puff', x: 4.4, z: -11.4, heading: 0.4, speed: 0.55, discovered: false },
			{ id: 2, kind: 'kite', x: 5.6, z: -12.6, heading: 2.1, speed: 0.72, discovered: false },
			{ id: 3, kind: 'lamb', x: 3.5, z: -12.8, heading: 4.0, speed: 0.42, discovered: false }
		],
		keys: { up: false, down: false, left: false, right: false },
		steer: null,
		paused: false,
		lowDetail: false,
		reducedMotion: false,
		soundOn: false,
		notice: '风会把你送到下一座岛。',
		t: 0,
		over: false
	};
}

export function setSkyKey(world: SkyWorld, key: keyof SkyKeys, down: boolean) {
	world.keys[key] = down;
}

export function setSkySteer(world: SkyWorld, x: number, z: number | null) {
	if (z === null) {
		world.steer = null;
		return;
	}
	world.steer = { x, z };
}

export function jumpSky(world: SkyWorld) {
	if (world.paused || !world.onGround) return;
	world.vy = JUMP;
	world.onGround = false;
	world.airborne = true;
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
						: '夜色在云圃里亮起来。';
	}
}

function wishDir(world: SkyWorld) {
	let wx = 0;
	let wz = 0;
	if (world.keys.right) wx += 1;
	if (world.keys.left) wx -= 1;
	if (world.keys.down) wz += 1;
	if (world.keys.up) wz -= 1;
	if (world.steer) {
		const dx = world.steer.x - world.x;
		const dz = world.steer.z - world.z;
		if (Math.hypot(dx, dz) > 0.28) {
			wx += dx;
			wz += dz;
		} else {
			world.steer = null;
		}
	}
	const len = Math.hypot(wx, wz);
	if (len < 0.001) return { x: 0, z: 0 };
	return { x: wx / len, z: wz / len };
}

function moveCreatures(world: SkyWorld, dt: number) {
	const home = world.islands[3];
	for (const c of world.creatures) {
		c.heading += (Math.sin(world.t * 0.0004 + c.id) * 0.0018 + 0.0004) * dt;
		c.x += Math.cos(c.heading) * c.speed * 0.0011 * dt;
		c.z += Math.sin(c.heading) * c.speed * 0.0011 * dt;
		const d = hypot2(c.x - home.x, c.z - home.z);
		if (d > home.r - 0.55) {
			c.heading += Math.PI * 0.55;
			c.x = home.x + ((c.x - home.x) / d) * (home.r - 0.7);
			c.z = home.z + ((c.z - home.z) / d) * (home.r - 0.7);
		}
		if (!c.discovered && hypot2(world.x - c.x, world.z - c.z) < 2.35 && world.island === 3) {
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

function tick(world: SkyWorld, dt: number) {
	world.t += dt;
	world.bounceCool = Math.max(0, world.bounceCool - dt);
	for (const plant of world.garden) {
		plant.grown = Math.min(1, plant.grown + dt * 0.00055);
	}

	const wish = wishDir(world);
	const tubeT = windT(world.x, world.y + 0.4, world.z);
	const inTube = inWindTube(world.x, world.y + 0.4, world.z) && tubeT < 0.94;
	world.inWind = inTube;
	if (inTube) {
		world.didWind = true;
		const dx = WIND.bx - WIND.ax;
		const dy = WIND.by - WIND.ay;
		const dz = WIND.bz - WIND.az;
		const len = Math.hypot(dx, dy, dz) || 1;
		world.vx = (dx / len) * WIND_SPEED;
		world.vy = (dy / len) * WIND_SPEED;
		world.vz = (dz / len) * WIND_SPEED;
		world.x += world.vx * dt;
		world.y += world.vy * dt;
		world.z += world.vz * dt;
		world.onGround = false;
		world.airborne = true;
	} else {
		const speed = world.onGround ? WALK : AIR;
		world.vx = wish.x * speed + world.bounceVx;
		world.vz = wish.z * speed + world.bounceVz;
		world.x += world.vx * dt;
		world.z += world.vz * dt;
		if (!world.onGround) {
			world.vy -= GRAVITY * dt;
			world.y += world.vy * dt;
		}
		const decay = world.onGround ? Math.pow(0.9, dt / 16) : Math.pow(0.997, dt);
		world.bounceVx *= decay;
		world.bounceVz *= decay;
		if (Math.abs(world.bounceVx) < 0.00005) world.bounceVx = 0;
		if (Math.abs(world.bounceVz) < 0.00005) world.bounceVz = 0;
	}

	if (wish.x || wish.z) world.yaw = Math.atan2(wish.x, wish.z);

	let landed = false;
	const isle = nearestIsland(world);
	if (isle && !inTube && world.y <= isle.y + 0.62 && world.vy <= 0.002) {
		if (hypot2(world.x - isle.x, world.z - isle.z) <= isle.r) {
			world.y = isle.y;
			world.vy = 0;
			world.onGround = true;
			world.airborne = false;
			world.island = isle.id;
			markVisit(world, isle.id);
			landed = true;
		}
	}

	if (!landed && !world.inWind && world.bounceCool <= 0 && world.vy <= 0.003) {
		for (const cloud of world.clouds) {
			const d = hypot2(world.x - cloud.x, world.z - cloud.z);
			if (d > cloud.r) continue;
			if (world.y < cloud.y - 0.2 || world.y > cloud.y + 1.35) continue;
			world.didBounce = true;
			world.bounceCool = 420;
			world.vy = BOUNCE_VY;
			world.bounceVx += BOUNCE_VX;
			world.bounceVz += (1.2 - world.z) * 0.0008;
			world.y = cloud.y + 0.05;
			world.onGround = false;
			world.airborne = true;
			world.notice = '踩到云了。';
			break;
		}
	}

	if (!landed && !world.inWind && world.y < -1.2) {
		const home = world.islands[world.island] ?? world.islands[0];
		world.x = home.x;
		world.y = home.y;
		world.z = home.z;
		world.vx = 0;
		world.vy = 0;
		world.vz = 0;
		world.onGround = true;
		world.airborne = false;
		world.notice = '云接住了你。';
	}

	if (isle && onIslandPad(world, isle)) {
		world.island = isle.id;
		markVisit(world, isle.id);
	}

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

export function enterWind(world: SkyWorld) {
	world.x = WIND.ax + 0.2;
	world.y = WIND.ay;
	world.z = WIND.az;
	world.onGround = false;
}

export function bounceCloud(world: SkyWorld) {
	const cloud = world.clouds[0];
	world.x = cloud.x;
	world.y = cloud.y + 0.2;
	world.z = cloud.z;
	world.vy = 0;
	world.onGround = false;
	world.bounceCool = 0;
	tick(world, 16);
}

export function collectFragment(world: SkyWorld, kind: FragKind) {
	const frag = world.fragments.find((f) => f.kind === kind);
	if (!frag) return;
	world.x = frag.x;
	world.y = frag.y;
	world.z = frag.z;
	collectNear(world);
}

export function restartSky(world: SkyWorld) {
	const next = createSky();
	next.lowDetail = world.lowDetail;
	next.audioWanted = world.audioWanted;
	next.dockCollapsed = world.dockCollapsed;
	Object.assign(world, next);
}

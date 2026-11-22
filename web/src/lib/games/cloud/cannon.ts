import type { SkyWorld } from './sim';

export const BULLET_POOL = 12;
export const SHARD_POOL = 48;
export const BULLET_SPEED = 12;
export const BULLET_LIFE = 1400;
export const SHARD_LIFE = 1200;
export const BULLET_R = 0.7;
export const SHARDS_PER_HIT = 8;
export const FIRE_GAP = 160;
export const ARM_DIST = 1.6;

export type SkyBullet = {
	live: boolean;
	x: number;
	y: number;
	z: number;
	vx: number;
	vy: number;
	vz: number;
	born: number;
};

export type SkyShard = {
	live: boolean;
	x: number;
	y: number;
	z: number;
	born: number;
	spin: number;
};

export type Breakable = {
	id: string;
	x: number;
	y: number;
	z: number;
	r: number;
	protect?: boolean;
};

export function flyAimAlongRay(
	origin: { x: number; y: number; z: number },
	dir: { x: number; y: number; z: number },
	dist = 14
) {
	const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
	return {
		x: origin.x + (dir.x / len) * dist,
		y: origin.y + (dir.y / len) * dist,
		z: origin.z + (dir.z / len) * dist
	};
}

export function emptyBullets(): SkyBullet[] {
	return Array.from({ length: BULLET_POOL }, () => ({
		live: false,
		x: 0,
		y: 0,
		z: 0,
		vx: 0,
		vy: 0,
		vz: 0,
		born: 0
	}));
}

export function emptyShards(): SkyShard[] {
	return Array.from({ length: SHARD_POOL }, () => ({
		live: false,
		x: 0,
		y: 0,
		z: 0,
		born: 0,
		spin: 0
	}));
}

function allocBullet(world: SkyWorld, now: number): SkyBullet {
	const idle = world.bullets.find((b) => !b.live);
	if (idle) return idle;
	let oldest = world.bullets[0]!;
	for (const b of world.bullets) {
		if (b.born < oldest.born) oldest = b;
	}
	return oldest;
}

function allocShard(world: SkyWorld): SkyShard {
	const idle = world.shards.find((s) => !s.live);
	if (idle) return idle;
	let oldest = world.shards[0]!;
	for (const s of world.shards) {
		if (s.born < oldest.born) oldest = s;
	}
	return oldest;
}

export function fireSkyCannon(
	world: SkyWorld,
	origin: { x: number; y: number; z: number },
	dir: { x: number; y: number; z: number },
	now: number
): SkyBullet {
	const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
	const bullet = allocBullet(world, now);
	bullet.live = true;
	bullet.x = origin.x;
	bullet.y = origin.y;
	bullet.z = origin.z;
	bullet.vx = (dir.x / len) * BULLET_SPEED;
	bullet.vy = (dir.y / len) * BULLET_SPEED;
	bullet.vz = (dir.z / len) * BULLET_SPEED;
	bullet.born = now;
	world.lastFire = now;
	return bullet;
}

function spawnShards(world: SkyWorld, at: { x: number; y: number; z: number }, now: number) {
	for (let i = 0; i < SHARDS_PER_HIT; i++) {
		const shard = allocShard(world);
		const a = (i / SHARDS_PER_HIT) * Math.PI * 2;
		shard.live = true;
		shard.x = at.x + Math.cos(a) * 0.85;
		shard.y = at.y + 0.35 + (i % 3) * 0.18;
		shard.z = at.z + Math.sin(a) * 0.85;
		shard.born = now;
		shard.spin = a;
	}
}

export function hideBreakable(world: SkyWorld, id: string, at: { x: number; y: number; z: number }, now: number) {
	if (world.hiddenIds.includes(id)) return;
	world.hiddenIds = [...world.hiddenIds, id];
	spawnShards(world, at, now);
	world.notice = '风景碎成云屑。重建云界可以拼回来。';
}

export function stepCannon(world: SkyWorld, dt: number, now: number, breakables: Breakable[]) {
	const sec = dt / 1000;
	for (const bullet of world.bullets) {
		if (!bullet.live) continue;
		if (now - bullet.born > BULLET_LIFE) {
			bullet.live = false;
			continue;
		}
		bullet.x += bullet.vx * sec;
		bullet.y += bullet.vy * sec;
		bullet.z += bullet.vz * sec;
		const traveled = BULLET_SPEED * ((now - bullet.born) / 1000);
		if (traveled < ARM_DIST) continue;
		for (const target of breakables) {
			if (target.protect) continue;
			if (world.hiddenIds.includes(target.id)) continue;
			const d = Math.hypot(bullet.x - target.x, bullet.y - target.y, bullet.z - target.z);
			if (d < target.r + BULLET_R) {
				hideBreakable(world, target.id, { x: bullet.x, y: bullet.y, z: bullet.z }, now);
				bullet.live = false;
				break;
			}
		}
	}
	for (const shard of world.shards) {
		if (!shard.live) continue;
		if (now - shard.born > SHARD_LIFE) shard.live = false;
	}
}

export function rebuildCloud(world: SkyWorld) {
	world.hiddenIds = [];
	for (const b of world.bullets) b.live = false;
	for (const s of world.shards) s.live = false;
	world.notice = '云界拼回来了。';
}

export function tryFireSky(
	world: SkyWorld,
	origin: { x: number; y: number; z: number },
	dir: { x: number; y: number; z: number },
	now: number
) {
	if (!world.fireHeld || world.paused) return null;
	if (now - world.lastFire < FIRE_GAP) return null;
	return fireSkyCannon(world, origin, dir, now);
}

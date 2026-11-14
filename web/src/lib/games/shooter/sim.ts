export const WORLD_W = 360;
export const WORLD_H = 640;
export const TICK_MS = 16;
export const LIVES = 3;
export const INVULN_TICKS = 90;
export const FIRE_EVERY = 8;
export const MAX_BULLETS = 48;
export const MAX_ENEMIES = 24;
export const MAX_OBSTACLES = 8;
export const MAX_FLOATS = 12;
export const WAVE_TICKS = 480;
export const TELEGRAPH_TICKS = 48;
export const ENEMY_SCORE = { scout: 50, fighter: 120, bomber: 200, boss: 1500 } as const;

export type EnemyKind = 'scout' | 'fighter' | 'bomber';
export type BossKind = 'fan' | 'dive' | 'ring';
export type BulletFrom = 'player' | 'enemy' | 'boss';
export type BossPhase = 'telegraph' | 'attack';

export interface Bullet {
	id: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
	w: number;
	h: number;
	from: BulletFrom;
	dmg: number;
}

export interface Enemy {
	id: number;
	kind: EnemyKind;
	x: number;
	y: number;
	vx: number;
	vy: number;
	w: number;
	h: number;
	hp: number;
	cool: number;
}

export interface Obstacle {
	id: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
	w: number;
	h: number;
}

export interface ScoreFloat {
	id: number;
	x: number;
	y: number;
	text: string;
	life: number;
}

export interface BossState {
	kind: BossKind;
	phase: BossPhase;
	x: number;
	y: number;
	vx: number;
	vy: number;
	w: number;
	h: number;
	hp: number;
	maxHp: number;
	age: number;
	cool: number;
}

export interface ShooterState {
	tick: number;
	accMs: number;
	paused: boolean;
	over: boolean;
	lives: number;
	score: number;
	invuln: number;
	fireCool: number;
	wave: number;
	waveTick: number;
	nextBossWave: number;
	bossIndex: number;
	boss: BossState | null;
	player: { x: number; y: number; w: number; h: number };
	aimX: number;
	aimY: number;
	autoSpawn: boolean;
	spawnWait: number;
	wreckWait: number;
	shots: number;
	bullets: Bullet[];
	enemies: Enemy[];
	obstacles: Obstacle[];
	floats: ScoreFloat[];
	nextId: number;
	rng: () => number;
}

export interface ShooterOptions {
	seed?: number;
	autoSpawn?: boolean;
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

function overlaps(
	a: { x: number; y: number; w: number; h: number },
	b: { x: number; y: number; w: number; h: number }
): boolean {
	return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function playerHurt(state: ShooterState) {
	const w = 14;
	const h = 18;
	return {
		x: state.player.x + (state.player.w - w) / 2,
		y: state.player.y + (state.player.h - h) / 2,
		w,
		h
	};
}

function cap<T>(list: T[], max: number) {
	if (list.length > max) list.splice(0, list.length - max);
}

function addFloat(state: ShooterState, x: number, y: number, amount: number) {
	state.floats.push({ id: state.nextId++, x, y, text: `+${amount}`, life: 40 });
	cap(state.floats, MAX_FLOATS);
}

function hitPlayer(state: ShooterState) {
	if (state.over || state.invuln > 0) return;
	state.lives -= 1;
	state.invuln = INVULN_TICKS;
	if (state.lives <= 0) {
		state.lives = 0;
		state.over = true;
	}
}

export function createShooter(options: ShooterOptions = {}): ShooterState {
	return {
		tick: 0,
		accMs: 0,
		paused: false,
		over: false,
		lives: LIVES,
		score: 0,
		invuln: 0,
		fireCool: 0,
		wave: 1,
		waveTick: 0,
		nextBossWave: 3,
		bossIndex: 0,
		boss: null,
		player: { x: WORLD_W / 2 - 11, y: WORLD_H - 86, w: 22, h: 28 },
		aimX: 0.5,
		aimY: 0.86,
		autoSpawn: options.autoSpawn ?? true,
		spawnWait: 20,
		wreckWait: 90,
		shots: 0,
		bullets: [],
		enemies: [],
		obstacles: [],
		floats: [],
		nextId: 1,
		rng: mulberry32(options.seed ?? 20261114)
	};
}

export function setAim(state: ShooterState, nx: number, ny: number) {
	state.aimX = Math.min(1, Math.max(0, nx));
	state.aimY = Math.min(1, Math.max(0, ny));
}

export function pauseShooter(state: ShooterState, paused: boolean) {
	if (state.over) return;
	state.paused = paused;
}

export function restartShooter(state: ShooterState, seed?: number) {
	Object.assign(state, createShooter({ seed, autoSpawn: state.autoSpawn }));
}

export function spawnEnemy(state: ShooterState, kind: EnemyKind, x: number, y: number): Enemy {
	const sizes = {
		scout: { w: 16, h: 16, hp: 1, vy: 1.7 },
		fighter: { w: 20, h: 18, hp: 2, vy: 1.2 },
		bomber: { w: 28, h: 22, hp: 4, vy: 0.75 }
	};
	const spec = sizes[kind];
	const enemy: Enemy = {
		id: state.nextId++,
		kind,
		x,
		y,
		vx: kind === 'scout' ? 0.8 : 0,
		vy: spec.vy,
		w: spec.w,
		h: spec.h,
		hp: spec.hp,
		cool: kind === 'scout' ? 999 : 40
	};
	state.enemies.push(enemy);
	cap(state.enemies, MAX_ENEMIES);
	return enemy;
}

export function spawnWreck(state: ShooterState, x: number, y: number): Obstacle {
	const wreck: Obstacle = {
		id: state.nextId++,
		x,
		y,
		vx: 0,
		vy: 1.35,
		w: 26,
		h: 22
	};
	state.obstacles.push(wreck);
	cap(state.obstacles, MAX_OBSTACLES);
	return wreck;
}

const BOSS_ORDER: BossKind[] = ['fan', 'dive', 'ring'];

export function spawnBoss(state: ShooterState, kind?: BossKind): BossState {
	const chosen = kind ?? BOSS_ORDER[state.bossIndex % BOSS_ORDER.length] ?? 'fan';
	const hp = chosen === 'fan' ? 28 : chosen === 'dive' ? 34 : 40;
	const boss: BossState = {
		kind: chosen,
		phase: 'telegraph',
		x: WORLD_W / 2 - 24,
		y: 48,
		vx: 1.1,
		vy: 0,
		w: 48,
		h: 34,
		hp,
		maxHp: hp,
		age: 0,
		cool: 0
	};
	state.boss = boss;
	state.bossIndex += 1;
	return boss;
}

function emitBullet(state: ShooterState, partial: Omit<Bullet, 'id'>) {
	state.bullets.push({ id: state.nextId++, ...partial });
	cap(state.bullets, MAX_BULLETS);
}

function fireFan(state: ShooterState, boss: BossState) {
	const cx = boss.x + boss.w / 2;
	const cy = boss.y + boss.h;
	for (let i = -2; i <= 2; i++) {
		const angle = Math.PI / 2 + i * 0.28;
		emitBullet(state, {
			x: cx - 3,
			y: cy,
			vx: Math.cos(angle) * 2.2,
			vy: Math.sin(angle) * 2.2,
			w: 6,
			h: 6,
			from: 'boss',
			dmg: 1
		});
	}
}

function fireRing(state: ShooterState, boss: BossState) {
	const cx = boss.x + boss.w / 2;
	const cy = boss.y + boss.h / 2;
	for (let i = 0; i < 10; i++) {
		const angle = (i / 10) * Math.PI * 2;
		emitBullet(state, {
			x: cx,
			y: cy,
			vx: Math.cos(angle) * 1.8,
			vy: Math.sin(angle) * 1.8,
			w: 6,
			h: 6,
			from: 'boss',
			dmg: 1
		});
	}
}

function tickBoss(state: ShooterState) {
	const boss = state.boss;
	if (!boss) return;
	boss.age += 1;
	boss.x += boss.vx;
	boss.y += boss.vy;
	if (boss.x < 16 || boss.x + boss.w > WORLD_W - 16) boss.vx *= -1;
	if (boss.phase === 'telegraph') {
		if (boss.age >= TELEGRAPH_TICKS) {
			boss.phase = 'attack';
			boss.cool = 0;
			if (boss.kind === 'fan') fireFan(state, boss);
			if (boss.kind === 'ring') fireRing(state, boss);
			if (boss.kind === 'dive') boss.vy = 3.4;
		}
		return;
	}
	boss.cool -= 1;
	if (boss.kind === 'fan' && boss.cool <= 0) {
		fireFan(state, boss);
		boss.cool = 42;
	}
	if (boss.kind === 'ring' && boss.cool <= 0) {
		fireRing(state, boss);
		boss.cool = 70;
	}
	if (boss.kind === 'dive') {
		if (boss.y > WORLD_H * 0.55) boss.vy = -2.4;
		if (boss.y < 46) {
			boss.y = 46;
			boss.vy = 0;
			if (boss.cool <= 0) {
				boss.vy = 3.4;
				boss.cool = 70;
			}
		}
	}
}

function maybeSpawn(state: ShooterState) {
	if (!state.autoSpawn || state.boss) return;
	state.waveTick += 1;
	if (state.waveTick >= WAVE_TICKS) {
		state.wave += 1;
		state.waveTick = 0;
	}
	if (state.wave >= state.nextBossWave) {
		spawnBoss(state);
		state.nextBossWave = state.wave + 3;
		return;
	}
	state.spawnWait -= 1;
	if (state.spawnWait <= 0) {
		const roll = state.rng();
		const kind: EnemyKind =
			state.wave >= 4 && roll > 0.72
				? 'bomber'
				: state.wave >= 2 && roll > 0.45
					? 'fighter'
					: 'scout';
		spawnEnemy(state, kind, 24 + state.rng() * (WORLD_W - 64), -28);
		state.spawnWait = Math.max(22, 78 - state.wave * 6);
	}
	state.wreckWait -= 1;
	if (state.wreckWait <= 0) {
		spawnWreck(state, 20 + state.rng() * (WORLD_W - 60), -30);
		state.wreckWait = Math.max(70, 140 - state.wave * 8);
	}
}

export function tickShooter(state: ShooterState) {
	if (state.paused || state.over) return;
	state.tick += 1;
	if (state.invuln > 0) state.invuln -= 1;

	const targetX = state.aimX * WORLD_W - state.player.w / 2;
	const targetY = state.aimY * WORLD_H - state.player.h / 2;
	state.player.x += Math.max(-4.6, Math.min(4.6, targetX - state.player.x));
	state.player.y += Math.max(-4.6, Math.min(4.6, targetY - state.player.y));
	state.player.x = Math.max(8, Math.min(WORLD_W - state.player.w - 8, state.player.x));
	state.player.y = Math.max(80, Math.min(WORLD_H - state.player.h - 12, state.player.y));

	state.fireCool -= 1;
	if (state.fireCool <= 0) {
		emitBullet(state, {
			x: state.player.x + state.player.w / 2 - 2,
			y: state.player.y - 6,
			vx: 0,
			vy: -7.2,
			w: 4,
			h: 10,
			from: 'player',
			dmg: 1
		});
		state.fireCool = FIRE_EVERY;
		state.shots += 1;
	}

	for (const bullet of state.bullets) {
		bullet.x += bullet.vx;
		bullet.y += bullet.vy;
	}
	state.bullets = state.bullets.filter(
		(bullet) =>
			bullet.x > -20 && bullet.x < WORLD_W + 20 && bullet.y > -24 && bullet.y < WORLD_H + 24
	);
	cap(state.bullets, MAX_BULLETS);

	for (const enemy of state.enemies) {
		if (enemy.kind === 'scout') {
			enemy.x += enemy.vx;
			if (enemy.x < 8 || enemy.x + enemy.w > WORLD_W - 8) enemy.vx *= -1;
		}
		enemy.y += enemy.vy;
		enemy.cool -= 1;
		if (enemy.kind !== 'scout' && enemy.cool <= 0 && enemy.y > 20 && enemy.y < WORLD_H * 0.7) {
			emitBullet(state, {
				x: enemy.x + enemy.w / 2 - 3,
				y: enemy.y + enemy.h,
				vx: 0,
				vy: enemy.kind === 'bomber' ? 2.8 : 3.4,
				w: 5,
				h: 8,
				from: 'enemy',
				dmg: 1
			});
			enemy.cool = enemy.kind === 'bomber' ? 54 : 38;
		}
	}
	state.enemies = state.enemies.filter((enemy) => enemy.y < WORLD_H + 40 && enemy.hp > 0);
	cap(state.enemies, MAX_ENEMIES);

	for (const wreck of state.obstacles) {
		wreck.y += wreck.vy;
	}
	state.obstacles = state.obstacles.filter((wreck) => wreck.y < WORLD_H + 40);
	cap(state.obstacles, MAX_OBSTACLES);

	tickBoss(state);

	for (const bullet of state.bullets) {
		if (bullet.from !== 'player') continue;
		for (const enemy of state.enemies) {
			if (enemy.hp <= 0) continue;
			if (!overlaps(bullet, enemy)) continue;
			enemy.hp -= bullet.dmg;
			bullet.y = -999;
			if (enemy.hp <= 0) {
				const prize = ENEMY_SCORE[enemy.kind];
				state.score += prize;
				addFloat(state, enemy.x, enemy.y, prize);
			}
		}
		if (state.boss && overlaps(bullet, state.boss)) {
			state.boss.hp -= bullet.dmg;
			bullet.y = -999;
			if (state.boss.hp <= 0) {
				state.score += ENEMY_SCORE.boss;
				addFloat(state, state.boss.x, state.boss.y, ENEMY_SCORE.boss);
				state.boss = null;
			}
		}
	}
	state.bullets = state.bullets.filter((bullet) => bullet.y > -80);
	state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);

	const hurt = playerHurt(state);
	for (const enemy of state.enemies) {
		if (overlaps(hurt, enemy)) hitPlayer(state);
	}
	for (const wreck of state.obstacles) {
		if (overlaps(hurt, wreck)) hitPlayer(state);
	}
	if (state.boss && overlaps(hurt, state.boss)) hitPlayer(state);
	for (const bullet of state.bullets) {
		if (bullet.from === 'player') continue;
		if (overlaps(hurt, bullet)) {
			bullet.y = -999;
			hitPlayer(state);
		}
	}
	state.bullets = state.bullets.filter((bullet) => bullet.y > -80);

	for (const floater of state.floats) floater.life -= 1;
	state.floats = state.floats.filter((floater) => floater.life > 0);

	maybeSpawn(state);
}

export function advance(state: ShooterState, elapsedMs: number) {
	if (state.paused || state.over) return;
	const capped = Math.min(Math.max(0, elapsedMs), 50);
	state.accMs += capped;
	let steps = 0;
	while (state.accMs >= TICK_MS && steps < 8) {
		tickShooter(state);
		state.accMs -= TICK_MS;
		steps += 1;
	}
}

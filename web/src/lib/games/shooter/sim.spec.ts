import { describe, expect, it } from 'vitest';
import {
	advance,
	createShooter,
	ENEMY_SCORE,
	LIVES,
	MAX_BULLETS,
	MAX_ENEMIES,
	restartShooter,
	spawnBoss,
	spawnEnemy,
	spawnWreck,
	tickShooter,
	type ShooterState
} from './sim';

function drive(state: ShooterState, n: number) {
	for (let i = 0; i < n; i++) tickShooter(state);
}

describe('晴空出击 simulation', () => {
	it('starts with exactly three lives and is not over', () => {
		const state = createShooter({ seed: 1, autoSpawn: false });
		expect(state.lives).toBe(LIVES);
		expect(state.lives).toBe(3);
		expect(state.over).toBe(false);
		expect(state.score).toBe(0);
	});

	it('awards distinct scores for scout, fighter, and bomber', () => {
		expect(ENEMY_SCORE.scout).not.toBe(ENEMY_SCORE.fighter);
		expect(ENEMY_SCORE.fighter).not.toBe(ENEMY_SCORE.bomber);
		expect(ENEMY_SCORE.scout).not.toBe(ENEMY_SCORE.bomber);

		const state = createShooter({ seed: 1, autoSpawn: false });
		const scout = spawnEnemy(state, 'scout', 40, 40);
		scout.hp = 1;
		state.bullets.push({
			id: state.nextId++,
			x: scout.x,
			y: scout.y,
			vx: 0,
			vy: 0,
			w: 6,
			h: 8,
			from: 'player',
			dmg: 1
		});
		tickShooter(state);
		expect(state.score).toBe(ENEMY_SCORE.scout);

		const fighter = spawnEnemy(state, 'fighter', 80, 40);
		fighter.hp = 1;
		state.bullets.push({
			id: state.nextId++,
			x: fighter.x,
			y: fighter.y,
			vx: 0,
			vy: 0,
			w: 6,
			h: 8,
			from: 'player',
			dmg: 1
		});
		tickShooter(state);
		expect(state.score).toBe(ENEMY_SCORE.scout + ENEMY_SCORE.fighter);

		const bomber = spawnEnemy(state, 'bomber', 120, 40);
		bomber.hp = 1;
		state.bullets.push({
			id: state.nextId++,
			x: bomber.x,
			y: bomber.y,
			vx: 0,
			vy: 0,
			w: 6,
			h: 8,
			from: 'player',
			dmg: 1
		});
		tickShooter(state);
		expect(state.score).toBe(ENEMY_SCORE.scout + ENEMY_SCORE.fighter + ENEMY_SCORE.bomber);
	});

	it('removes a life on overlap then grants invulnerability', () => {
		const state = createShooter({ seed: 1, autoSpawn: false });
		spawnEnemy(state, 'scout', state.player.x, state.player.y);
		tickShooter(state);
		expect(state.lives).toBe(2);
		expect(state.invuln).toBeGreaterThan(0);
		expect(state.over).toBe(false);
		const invuln = state.invuln;
		tickShooter(state);
		expect(state.lives).toBe(2);
		expect(state.invuln).toBe(invuln - 1);
	});

	it('ends the run after exactly three unprotected hits', () => {
		const state = createShooter({ seed: 1, autoSpawn: false });
		for (let hit = 0; hit < 3; hit++) {
			state.invuln = 0;
			state.enemies = [];
			spawnEnemy(state, 'scout', state.player.x, state.player.y);
			tickShooter(state);
		}
		expect(state.lives).toBe(0);
		expect(state.over).toBe(true);
		state.invuln = 0;
		spawnEnemy(state, 'scout', state.player.x, state.player.y);
		tickShooter(state);
		expect(state.lives).toBe(0);
	});

	it('lets wrecks damage the player the same way enemies do', () => {
		const state = createShooter({ seed: 1, autoSpawn: false });
		spawnWreck(state, state.player.x, state.player.y);
		tickShooter(state);
		expect(state.lives).toBe(2);
		expect(state.invuln).toBeGreaterThan(0);
		tickShooter(state);
		expect(state.lives).toBe(2);
	});

	it('caps elapsed-time stepping so a long pause cannot spiral', () => {
		const state = createShooter({ seed: 1, autoSpawn: false });
		const before = state.tick;
		advance(state, 5000);
		expect(state.tick - before).toBeLessThanOrEqual(8);
		expect(state.tick - before).toBeGreaterThan(0);
	});

	it('does not tick while paused or over', () => {
		const state = createShooter({ seed: 1, autoSpawn: false });
		state.paused = true;
		advance(state, 100);
		expect(state.tick).toBe(0);
		state.paused = false;
		state.over = true;
		advance(state, 100);
		expect(state.tick).toBe(0);
	});

	it('spawns a telegraphed boss then a distinct attack, and continues after it dies', () => {
		const fan = createShooter({ seed: 2, autoSpawn: false });
		spawnBoss(fan, 'fan');
		expect(fan.boss?.kind).toBe('fan');
		expect(fan.boss?.phase).toBe('telegraph');
		drive(fan, 20);
		expect(fan.boss?.phase).toBe('telegraph');
		expect(fan.bullets.some((bullet) => bullet.from === 'boss')).toBe(false);
		drive(fan, 40);
		expect(fan.boss?.phase).toBe('attack');
		expect(fan.bullets.some((bullet) => bullet.from === 'boss')).toBe(true);

		const dive = createShooter({ seed: 3, autoSpawn: false });
		spawnBoss(dive, 'dive');
		drive(dive, 55);
		expect(dive.boss?.phase).toBe('attack');
		const y0 = dive.boss?.y ?? 0;
		drive(dive, 12);
		expect(dive.boss?.y ?? 0).toBeGreaterThan(y0);

		const ring = createShooter({ seed: 4, autoSpawn: false });
		spawnBoss(ring, 'ring');
		drive(ring, 55);
		expect(ring.bullets.filter((bullet) => bullet.from === 'boss').length).toBeGreaterThanOrEqual(
			8
		);

		const after = createShooter({ seed: 5, autoSpawn: true });
		spawnBoss(after, 'fan');
		if (!after.boss) throw new Error('boss');
		after.boss.hp = 1;
		after.boss.phase = 'attack';
		after.bullets.push({
			id: after.nextId++,
			x: after.boss.x,
			y: after.boss.y,
			vx: 0,
			vy: 0,
			w: 8,
			h: 10,
			from: 'player',
			dmg: 4
		});
		const scoreBefore = after.score;
		tickShooter(after);
		expect(after.boss).toBeNull();
		expect(after.score).toBe(scoreBefore + ENEMY_SCORE.boss);
		const enemiesBefore = after.enemies.length;
		drive(after, 120);
		expect(after.enemies.length).toBeGreaterThan(enemiesBefore);
		expect(after.over).toBe(false);
	});

	it('keeps entity lists bounded', () => {
		const state = createShooter({ seed: 9, autoSpawn: false });
		for (let i = 0; i < 80; i++) {
			spawnEnemy(state, 'scout', 20 + (i % 10) * 12, 20);
			state.bullets.push({
				id: state.nextId++,
				x: 10,
				y: 10,
				vx: 0,
				vy: -2,
				w: 4,
				h: 6,
				from: 'player',
				dmg: 1
			});
		}
		tickShooter(state);
		expect(state.enemies.length).toBeLessThanOrEqual(MAX_ENEMIES);
		expect(state.bullets.length).toBeLessThanOrEqual(MAX_BULLETS);
	});

	it('auto-fires player bullets while alive', () => {
		const state = createShooter({ seed: 1, autoSpawn: false });
		drive(state, 20);
		expect(state.bullets.some((bullet) => bullet.from === 'player')).toBe(true);
	});

	it('restart restores lives and score', () => {
		const state = createShooter({ seed: 1, autoSpawn: false });
		state.score = 400;
		state.lives = 1;
		state.over = true;
		restartShooter(state, 1);
		expect(state.lives).toBe(3);
		expect(state.score).toBe(0);
		expect(state.over).toBe(false);
		expect(state.boss).toBeNull();
	});
});

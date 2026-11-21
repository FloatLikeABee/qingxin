import { describe, expect, it } from 'vitest';
import {
	COLLECT_RADIUS,
	CORAL_THRESHOLDS,
	HAUL_KINDS,
	STAR_COUNT,
	createTide,
	holdTide,
	nudgeTide,
	stepTide,
	steerTide
} from './sim';

describe('tide breath field', () => {
	it('raises swell while holding and emits a pulse on release', () => {
		const world = createTide();
		holdTide(world, true);
		stepTide(world, 800);
		expect(world.swell).toBeGreaterThan(0.2);
		const swell = world.swell;
		holdTide(world, false);
		stepTide(world, 50);
		expect(world.pulse).toBeGreaterThan(0.3);
		expect(world.holding).toBe(false);
		stepTide(world, 400);
		expect(world.swell).toBeLessThan(swell);
	});

	it('does not fail or lock if the optional pace is ignored', () => {
		const world = createTide();
		stepTide(world, 20_000);
		expect(world.over).toBe(false);
		expect(world.collected).toBe(0);
		expect(world.paceHint).toBeGreaterThanOrEqual(0);
		expect(world.paceHint).toBeLessThanOrEqual(1);
	});

	it('starts a jelly close enough to the first star for a guest to collect', () => {
		const world = createTide();
		expect(world.stars).toHaveLength(STAR_COUNT);
		expect(world.coral).toHaveLength(CORAL_THRESHOLDS.length);
		expect(world.creatures.some((c) => c.kind === 'jelly')).toBe(true);
		expect(world.creatures.some((c) => c.kind === 'lantern')).toBe(true);
		expect(world.creatures.some((c) => c.kind === 'manta')).toBe(true);
		const jelly = world.creatures.find((c) => c.kind === 'jelly')!;
		const near = world.stars
			.map((star) => Math.hypot(star.x - jelly.x, star.z - jelly.z))
			.sort((a, b) => a - b)[0]!;
		expect(near).toBeLessThan(COLLECT_RADIUS + 0.7);
		expect(near).toBeGreaterThan(COLLECT_RADIUS);
	});

	it('steers the selected creature and collects nearby starlight then unlocks coral', () => {
		const world = createTide();
		const jelly = world.creatures.find((c) => c.kind === 'jelly')!;
		world.selected = jelly.id;
		const star = world.stars
			.slice()
			.sort(
				(a, b) =>
					Math.hypot(a.x - jelly.x, a.z - jelly.z) - Math.hypot(b.x - jelly.x, b.z - jelly.z)
			)[0]!;
		steerTide(world, star.x, star.z);
		holdTide(world, true);
		for (let i = 0; i < 80; i++) stepTide(world, 100);
		expect(world.collected).toBeGreaterThanOrEqual(1);
		expect(star.collected).toBe(true);
		expect(world.coral.filter((c) => c.unlocked).length).toBeGreaterThanOrEqual(1);
		expect(world.coral[0]!.growth).toBeGreaterThan(0);
	});

	it('lets arrow nudges close the last gap without a timer', () => {
		const world = createTide();
		const jelly = world.creatures.find((c) => c.kind === 'jelly')!;
		world.selected = jelly.id;
		const before = { x: jelly.x, z: jelly.z };
		nudgeTide(world, 0, -1);
		expect(jelly.z).toBeLessThan(before.z);
		expect(world.over).toBe(false);
	});

	it('names six distinct 海光 kinds, keeps coral 1/3/6, and uses 海光 copy', () => {
		expect(HAUL_KINDS).toEqual(['水母光', '灯笼', '月光水母盘', '浮游团', '夜光贝', '海草穗']);
		expect(CORAL_THRESHOLDS).toEqual([1, 3, 6]);
		expect(STAR_COUNT).toBe(6);
		const world = createTide();
		expect(world.stars.map((star) => star.id)).toEqual([0, 1, 2, 3, 4, 5]);
		expect(world.stars.map((star) => star.kind)).toEqual([...HAUL_KINDS]);
		expect(new Set(world.stars.map((star) => star.kind)).size).toBe(6);
		holdTide(world, true);
		holdTide(world, false);
		expect(world.notice).toMatch(/海光/);
		const jelly = world.creatures.find((c) => c.kind === 'jelly')!;
		world.selected = jelly.id;
		const star = world.stars[0]!;
		jelly.x = star.x;
		jelly.z = star.z;
		nudgeTide(world, 0, 0);
		expect(world.notice).toMatch(/捡到海光 1 \/ 6/);
	});

	it('pauses when asked and does not move swell', () => {
		const world = createTide();
		holdTide(world, true);
		world.paused = true;
		const swell = world.swell;
		stepTide(world, 1000);
		expect(world.swell).toBe(swell);
	});
});

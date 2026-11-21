import { describe, expect, it } from 'vitest';
import {
	COLLECT_RADIUS,
	CORAL_THRESHOLDS,
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

	it('pauses when asked and does not move swell', () => {
		const world = createTide();
		holdTide(world, true);
		world.paused = true;
		const swell = world.swell;
		stepTide(world, 1000);
		expect(world.swell).toBe(swell);
	});
});

import { describe, expect, it } from 'vitest';
import { collectNear, createSky, FRAG_KINDS, jumpSky, setSkyKey, stepSky } from './sim';

function drive(world: ReturnType<typeof createSky>, ms: number, keys?: Partial<typeof world.keys>) {
	if (keys?.right) setSkyKey(world, 'right', true);
	if (keys?.left) setSkyKey(world, 'left', true);
	if (keys?.up) setSkyKey(world, 'up', true);
	if (keys?.down) setSkyKey(world, 'down', true);
	let left = ms;
	while (left > 0) {
		const dt = Math.min(50, left);
		stepSky(world, dt);
		left -= dt;
	}
}

describe('cloud walk field', () => {
	it('starts on the home island with dawn sky and an empty garden', () => {
		const world = createSky();
		expect(world.island).toBe(0);
		expect(world.skyMode).toBe('dawn');
		expect(world.garden).toHaveLength(0);
		expect(world.over).toBe(false);
		expect(world.creatures.map((c) => c.kind).sort()).toEqual(['kite', 'lamb', 'puff']);
		expect(world.fragments.map((f) => f.kind).sort()).toEqual([...FRAG_KINDS].sort());
	});

	it('rides a wind current from home onto the next island', () => {
		const world = createSky();
		drive(world, 9000, { right: true });
		expect(world.didWind).toBe(true);
		expect(world.visited.includes(1)).toBe(true);
		expect(world.island).toBeGreaterThanOrEqual(1);
	});

	it('bounces on a cloud toward a further island', () => {
		const world = createSky();
		drive(world, 16000, { right: true });
		expect(world.didBounce).toBe(true);
		expect(world.visited.includes(2)).toBe(true);
	});

	it('collects weather fragments that retint the sky and grow the cloud garden', () => {
		const world = createSky();
		drive(world, 18000, { right: true });
		const taken = world.fragments.filter((f) => f.collected).map((f) => f.kind);
		expect(taken.length).toBeGreaterThanOrEqual(1);
		expect(world.skyMode).not.toBe('dawn');
		expect(taken).toContain(world.skyMode);
		expect(world.garden.map((p) => p.kind).sort()).toEqual([...taken].sort());
	});

	it('lets a nearby collect finish without a timer fail', () => {
		const world = createSky();
		const frag = world.fragments.find((f) => f.kind === 'sun')!;
		world.x = frag.x;
		world.z = frag.z;
		world.y = frag.y;
		collectNear(world);
		expect(world.over).toBe(false);
		expect(world.skyMode).toBe('sun');
		expect(world.garden.some((p) => p.kind === 'sun')).toBe(true);
		stepSky(world, 30_000);
		expect(world.over).toBe(false);
	});

	it('pauses without sliding off the island', () => {
		const world = createSky();
		setSkyKey(world, 'right', true);
		world.paused = true;
		const x = world.x;
		stepSky(world, 800);
		expect(world.x).toBe(x);
	});

	it('jumps only while grounded', () => {
		const world = createSky();
		expect(world.onGround).toBe(true);
		jumpSky(world);
		expect(world.vy).toBeGreaterThan(0);
		expect(world.onGround).toBe(false);
		const vy = world.vy;
		jumpSky(world);
		expect(world.vy).toBe(vy);
	});
});

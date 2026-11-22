import { describe, expect, it } from 'vitest';
import {
	FRAG_KINDS,
	HOME,
	WORLD_R,
	Y_MAX,
	biomeAt,
	chaseOffset,
	collectNear,
	createSky,
	setSkyKey,
	setSkyLook,
	skyControlFromKeyboard,
	stepSky
} from './sim';

function drive(world: ReturnType<typeof createSky>, ms: number, keys?: Partial<typeof world.keys>) {
	for (const key of Object.keys(world.keys) as Array<keyof typeof world.keys>) {
		world.keys[key] = false;
	}
	if (keys) {
		for (const [key, down] of Object.entries(keys)) {
			if (down) setSkyKey(world, key as keyof typeof world.keys, true);
		}
	}
	let left = ms;
	while (left > 0) {
		const dt = Math.min(50, left);
		stepSky(world, dt);
		left -= dt;
	}
}

describe('cloud walk sandbox', () => {
	it('starts at home garden with dawn sky and an empty garden', () => {
		const world = createSky();
		expect(world.x).toBe(HOME.x);
		expect(world.y).toBe(HOME.y);
		expect(world.biome).toBe('garden');
		expect(world.skyMode).toBe('dawn');
		expect(world.garden).toHaveLength(0);
		expect(world.over).toBe(false);
		expect(world.fragments.map((f) => f.kind).sort()).toEqual([...FRAG_KINDS].sort());
	});

	it('climbs past Y 6 without needing an island', () => {
		const world = createSky();
		drive(world, 2500, { rise: true });
		expect(world.y).toBeGreaterThan(6);
		expect(world.biome).toBe('garden');
		expect(world.over).toBe(false);
	});

	it('keeps the chase camera inside the water column instead of above the well', () => {
		const water = chaseOffset('water');
		const grotto = chaseOffset('underworld');
		const garden = chaseOffset('garden');
		expect(water.height).toBeLessThan(1.2);
		expect(grotto.height).toBeLessThan(1.6);
		expect(garden.height).toBeGreaterThan(4);
		expect(water.dist).toBeLessThan(garden.dist);
	});

	it('maps Shift to dive and Space to rise without Shift+P pausing', () => {
		expect(skyControlFromKeyboard({ code: 'ShiftLeft', key: 'Shift' })).toEqual({ move: 'dive' });
		expect(skyControlFromKeyboard({ code: 'ShiftRight', key: 'Shift' })).toEqual({ move: 'dive' });
		expect(skyControlFromKeyboard({ code: '', key: 'Shift' })).toEqual({ move: 'dive' });
		expect(skyControlFromKeyboard({ code: 'Space', key: ' ' })).toEqual({ move: 'rise' });
		expect(skyControlFromKeyboard({ code: 'KeyP', key: 'p' })).toEqual({ pause: true });
		expect(skyControlFromKeyboard({ code: 'KeyP', key: 'P', shiftKey: true })).toEqual({});
		expect(skyControlFromKeyboard({ code: 'KeyF', key: 'f' })).toEqual({ fire: true });
		const world = createSky();
		const move = skyControlFromKeyboard({ code: 'ShiftLeft', key: 'Shift' }).move;
		expect(move).toBe('dive');
		drive(world, 900, { [move!]: true });
		expect(world.y).toBeLessThan(0);
		expect(world.keys.dive).toBe(true);
	});

	it('dives through the well into water then underworld', () => {
		const world = createSky();
		expect(biomeAt(0.2, -1, -0.55)).toBe('water');
		expect(biomeAt(0.2, -7, -0.55)).toBe('underworld');
		drive(world, 900, { dive: true });
		expect(world.y).toBeLessThan(0);
		expect(['water', 'underworld']).toContain(world.biome);
		drive(world, 2800, { dive: true });
		expect(world.y).toBeLessThan(-6);
		expect(world.biome).toBe('underworld');
		expect(world.biomes).toContain('water');
		expect(world.biomes).toContain('underworld');
	});

	it('flies into alien plateaus and the upside-down city', () => {
		const world = createSky();
		setSkyLook(world, 1, 0);
		world.y = 3;
		drive(world, 4000, { up: true });
		expect(world.x).toBeGreaterThan(8);
		expect(world.biome).toBe('alien');
		expect(world.biomes).toContain('alien');
		const city = createSky();
		setSkyLook(city, 0, -1);
		city.y = 8;
		drive(city, 5000, { up: true });
		expect(city.z).toBeLessThan(-6);
		expect(city.biome).toBe('city');
	});

	it('cannot leave the cylinder and home recall returns to the hut', () => {
		const world = createSky();
		world.x = 50;
		world.z = 0;
		world.y = 4;
		stepSky(world, 80);
		expect(Math.hypot(world.x, world.z)).toBeLessThanOrEqual(WORLD_R + 0.05);
		world.x = WORLD_R;
		world.z = 0;
		world.y = 4;
		world.boundTimer = 1550;
		stepSky(world, 80);
		expect(world.x).toBeCloseTo(HOME.x, 5);
		expect(world.y).toBeCloseTo(HOME.y, 5);
		expect(world.notice).toMatch(/送回家/);
	});

	it('collects optional weather fragments that retint the sky and grow the cloud garden', () => {
		const world = createSky();
		const frag = world.fragments.find((f) => f.kind === 'sun')!;
		world.x = frag.x;
		world.y = frag.y;
		world.z = frag.z;
		collectNear(world);
		expect(world.skyMode).toBe('sun');
		expect(world.garden.some((p) => p.kind === 'sun')).toBe(true);
		stepSky(world, 30_000);
		expect(world.over).toBe(false);
	});

	it('A/D strafes across yaw 0 without spinning the heading', () => {
		const world = createSky();
		world.yaw = 0;
		world.lookX = 0;
		world.lookZ = 1;
		world.x = 0;
		world.z = 0;
		setSkyKey(world, 'right', true);
		for (let i = 0; i < 125; i++) stepSky(world, 16);
		expect(world.yaw).toBeCloseTo(0, 5);
		expect(world.x).toBeGreaterThan(2);
		expect(Math.abs(world.z)).toBeLessThan(0.3);
		expect(world.lookX).toBeCloseTo(0, 5);
		expect(world.lookZ).toBeCloseTo(1, 5);
	});

	it('yaw 0 hold W stays on +Z even if lookX is camera-stale', () => {
		const world = createSky();
		world.yaw = 0;
		world.lookX = 1;
		world.lookZ = 0;
		world.x = 0;
		world.z = 0;
		setSkyKey(world, 'up', true);
		for (let i = 0; i < 125; i++) stepSky(world, 16);
		expect(Math.abs(world.x)).toBeLessThan(0.3);
		expect(world.z).toBeGreaterThan(2);
		expect(world.lookX).toBeCloseTo(0, 5);
		expect(world.lookZ).toBeCloseTo(1, 5);
	});

	it('pauses without drifting', () => {
		const world = createSky();
		setSkyKey(world, 'rise', true);
		world.paused = true;
		const y = world.y;
		stepSky(world, 800);
		expect(world.y).toBe(y);
	});
});

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
	FRAG_KINDS,
	HOME,
	WORLD_R,
	Y_MAX,
	biomeAt,
	chaseOffset,
	collectNear,
	createSky,
	releaseSkyControls,
	setSkyKey,
	setSkyLook,
	setSkySteer,
	skyControlFromKeyboard,
	skyRight,
	stepSky,
	type SkyWorld
} from './sim';

function freezeChaseCam(world: Pick<SkyWorld, 'x' | 'y' | 'z' | 'yaw' | 'biome'>) {
	const chase = chaseOffset(world.biome);
	const cam = new THREE.PerspectiveCamera(46, 16 / 9, 0.12, 220);
	cam.up.set(0, 1, 0);
	cam.position.set(
		world.x - Math.sin(world.yaw) * chase.dist,
		world.y + chase.height,
		world.z - Math.cos(world.yaw) * chase.dist
	);
	cam.lookAt(world.x, world.y + chase.lift, world.z);
	cam.updateMatrixWorld();
	cam.updateProjectionMatrix();
	return cam;
}

function ndcX(cam: InstanceType<typeof THREE.PerspectiveCamera>, x: number, y: number, z: number) {
	return new THREE.Vector3(x, y, z).project(cam).x;
}

function camRightXZ(cam: InstanceType<typeof THREE.PerspectiveCamera>) {
	const e = cam.matrixWorld.elements;
	return { x: e[0], z: e[2] };
}

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

	it('skyRight matches the chase camera +X axis', () => {
		for (const yaw of [0, 1.18, Math.PI / 2, Math.PI, -0.7]) {
			const world = createSky();
			world.yaw = yaw;
			const cam = freezeChaseCam(world);
			const want = skyRight(yaw);
			const got = camRightXZ(cam);
			expect(want.x).toBeCloseTo(got.x, 5);
			expect(want.z).toBeCloseTo(got.z, 5);
		}
	});

	it('maps A/ArrowLeft to left and D/ArrowRight to right', () => {
		expect(skyControlFromKeyboard({ code: 'KeyA', key: 'a' })).toEqual({ move: 'left' });
		expect(skyControlFromKeyboard({ code: 'ArrowLeft', key: 'ArrowLeft' })).toEqual({
			move: 'left'
		});
		expect(skyControlFromKeyboard({ code: 'KeyD', key: 'd' })).toEqual({ move: 'right' });
		expect(skyControlFromKeyboard({ code: 'ArrowRight', key: 'ArrowRight' })).toEqual({
			move: 'right'
		});
	});

	it('D and ArrowRight raise frozen-cam NDC x at yaw 0 without spinning', () => {
		for (const key of ['right'] as const) {
			const world = createSky();
			world.yaw = 0;
			world.lookX = 0;
			world.lookZ = 1;
			world.x = 0;
			world.z = 0;
			const cam = freezeChaseCam(world);
			const start = ndcX(cam, world.x, world.y, world.z);
			const right = camRightXZ(cam);
			expect(right.x).toBeLessThan(-0.5);
			setSkyKey(world, key, true);
			for (let i = 0; i < 125; i++) stepSky(world, 16);
			const end = ndcX(cam, world.x, world.y, world.z);
			const alongRight = (world.x - 0) * right.x + (world.z - 0) * right.z;
			expect(world.yaw).toBeCloseTo(0, 5);
			expect(end).toBeGreaterThan(start);
			expect(alongRight).toBeGreaterThan(2);
			expect(Math.abs(world.z)).toBeLessThan(0.3);
			expect(world.lookX).toBeCloseTo(0, 5);
			expect(world.lookZ).toBeCloseTo(1, 5);
		}
	});

	it('A and ArrowLeft lower frozen-cam NDC x at yaw 0', () => {
		const world = createSky();
		world.yaw = 0;
		world.lookX = 0;
		world.lookZ = 1;
		world.x = 0;
		world.z = 0;
		const cam = freezeChaseCam(world);
		const start = ndcX(cam, world.x, world.y, world.z);
		setSkyKey(world, 'left', true);
		for (let i = 0; i < 125; i++) stepSky(world, 16);
		expect(ndcX(cam, world.x, world.y, world.z)).toBeLessThan(start);
		expect(world.x).toBeGreaterThan(2);
		expect(world.yaw).toBeCloseTo(0, 5);
	});

	it('signed screen-right holds for other headings and underwater chase', () => {
		const headings = [0, Math.PI / 2, Math.PI, -0.7];
		for (const yaw of headings) {
			const world = createSky();
			world.yaw = yaw;
			world.lookX = Math.sin(yaw);
			world.lookZ = Math.cos(yaw);
			world.x = 1.2;
			world.z = -0.4;
			const cam = freezeChaseCam(world);
			const start = ndcX(cam, world.x, world.y, world.z);
			const origin = { x: world.x, z: world.z };
			setSkyKey(world, 'right', true);
			for (let i = 0; i < 80; i++) stepSky(world, 16);
			expect(ndcX(cam, world.x, world.y, world.z)).toBeGreaterThan(start);
			expect(world.yaw).toBeCloseTo(yaw, 5);
			const dx = world.x - origin.x;
			const dz = world.z - origin.z;
			const right = camRightXZ(cam);
			expect(dx * right.x + dz * right.z).toBeGreaterThan(1);
		}
		const wet = createSky();
		wet.x = 0.2;
		wet.y = -2.4;
		wet.z = -0.55;
		wet.yaw = 0;
		wet.lookX = 0;
		wet.lookZ = 1;
		expect(biomeAt(wet.x, wet.y, wet.z)).toBe('water');
		wet.biome = 'water';
		const cam = freezeChaseCam(wet);
		const start = ndcX(cam, wet.x, wet.y, wet.z);
		setSkyKey(wet, 'right', true);
		for (let i = 0; i < 80; i++) stepSky(wet, 16);
		expect(wet.biome).toBe('water');
		expect(ndcX(cam, wet.x, wet.y, wet.z)).toBeGreaterThan(start);
	});

	it('W+D diagonal is forward and screen-right', () => {
		const world = createSky();
		world.yaw = 0;
		world.lookX = 0;
		world.lookZ = 1;
		world.x = 0;
		world.z = 0;
		const cam = freezeChaseCam(world);
		const start = ndcX(cam, world.x, world.y, world.z);
		setSkyKey(world, 'up', true);
		setSkyKey(world, 'right', true);
		for (let i = 0; i < 125; i++) stepSky(world, 16);
		expect(world.z).toBeGreaterThan(1.2);
		expect(ndcX(cam, world.x, world.y, world.z)).toBeGreaterThan(start);
		expect(world.yaw).toBeCloseTo(0, 5);
	});

	it('steer toward a screen-left aim point lowers frozen NDC x', () => {
		const world = createSky();
		world.yaw = 0;
		world.lookX = 0;
		world.lookZ = 1;
		world.x = 0;
		world.z = 0;
		const cam = freezeChaseCam(world);
		const left = { x: 5, y: world.y, z: 0 };
		expect(ndcX(cam, left.x, left.y, left.z)).toBeLessThan(ndcX(cam, 0, world.y, 0));
		const start = ndcX(cam, world.x, world.y, world.z);
		setSkySteer(world, left.x, left.y, left.z);
		for (let i = 0; i < 90; i++) stepSky(world, 16);
		expect(ndcX(cam, world.x, world.y, world.z)).toBeLessThan(start);
		expect(world.x).toBeGreaterThan(1);
	});

	it('releaseSkyControls stops leftover strafe on the next tick', () => {
		const world = createSky();
		world.yaw = 0;
		world.x = 0;
		world.z = 0;
		setSkyKey(world, 'right', true);
		stepSky(world, 80);
		releaseSkyControls(world);
		const x = world.x;
		const z = world.z;
		stepSky(world, 400);
		expect(world.x).toBeCloseTo(x, 5);
		expect(world.z).toBeCloseTo(z, 5);
		expect(world.keys.right).toBe(false);
		expect(world.steer).toBeNull();
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

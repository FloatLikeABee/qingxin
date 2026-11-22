import { describe, expect, it } from 'vitest';
import {
	BUILDING_POOL,
	CAR_POOL,
	ROAD_POOL,
	TREE_POOL,
	autoFollowHaul,
	createHaul,
	haulAhead,
	haulJointGaps,
	haulRight,
	haulPools,
	haulSpineDepth,
	minPieceRadius,
	pieceConnected,
	recoverHaul,
	setHaulControl,
	simulateHaulMeters,
	stepHaul
} from './sim';

describe('cargo haul sim', () => {
	it('builds a packed connected graph with feasible turns and mixed biomes', () => {
		const world = createHaul(7);
		expect(world.pieces.length).toBeGreaterThan(4);
		expect(world.pieces.length).toBeLessThanOrEqual(ROAD_POOL);
		expect(world.pieces.some((p) => p.biome === 'highway')).toBe(true);
		expect(world.pieces.some((p) => p.exits.length >= 1 || p.frontier)).toBe(true);
		for (const piece of world.pieces) {
			expect(minPieceRadius(piece)).toBeGreaterThanOrEqual(18);
			if (!piece.frontier) expect(pieceConnected(world, piece.id)).toBe(true);
		}
		expect(world.speed).toBeGreaterThan(2);
		expect(world.onRoad).toBe(true);
	});

	it('throttle raises speed, brake lowers it, steer changes yaw', () => {
		const world = createHaul(3);
		world.speed = 8;
		setHaulControl(world, 'throttle', 1);
		stepHaul(world, 800);
		const sped = world.speed;
		expect(sped).toBeGreaterThan(12);
		setHaulControl(world, 'throttle', 0);
		setHaulControl(world, 'brake', 1);
		stepHaul(world, 400);
		expect(world.speed).toBeLessThan(sped - 2);
		world.speed = 12;
		setHaulControl(world, 'brake', 0);
		const yaw0 = world.yaw;
		setHaulControl(world, 'steer', 1);
		stepHaul(world, 400);
		expect(Math.abs(world.yaw - yaw0)).toBeGreaterThan(0.08);
	});

	it('reverse gear makes speed negative and still turns', () => {
		const world = createHaul(11);
		world.speed = 0.2;
		setHaulControl(world, 'reverse', 1);
		setHaulControl(world, 'throttle', 1);
		setHaulControl(world, 'steer', -1);
		const yaw0 = world.yaw;
		stepHaul(world, 700);
		expect(world.speed).toBeLessThan(-1);
		expect(world.gear).toBe('reverse');
		expect(Math.abs(world.yaw - yaw0)).toBeGreaterThan(0.04);
	});

	it('recycles pools after 50 km of generation without leaking live ids', () => {
		const world = createHaul(21);
		simulateHaulMeters(world, 50_000);
		const pools = haulPools(world);
		expect(pools.roads).toBeLessThanOrEqual(ROAD_POOL);
		expect(pools.trees).toBeLessThanOrEqual(TREE_POOL);
		expect(pools.buildings).toBeLessThanOrEqual(BUILDING_POOL);
		expect(pools.cars).toBeLessThanOrEqual(CAR_POOL);
		expect(world.odometer).toBeGreaterThan(40_000);
		expect(Number.isFinite(world.x) && Number.isFinite(world.z)).toBe(true);
		const ids = world.pieces.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(world.pieces.some((p) => p.biome === 'city')).toBe(true);
		expect(world.pieces.some((p) => p.biome === 'country')).toBe(true);
	}, 20_000);

	it('auto-follow stays on pavement through junctions', () => {
		const world = createHaul(5);
		for (let i = 0; i < 240; i++) {
			autoFollowHaul(world, 'main');
			stepHaul(world, 32);
		}
		expect(world.onRoad).toBe(true);
		expect(world.odometer).toBeGreaterThan(40);
	});

	it('taking an exit changes biome by driving, not teleport', () => {
		const world = createHaul(7);
		const start = { x: world.x, z: world.z, biome: world.biome };
		let changed = false;
		for (let i = 0; i < 4000; i++) {
			autoFollowHaul(world, world.forkNearby ? 'exit' : 'main');
			stepHaul(world, 32);
			if (world.biome !== start.biome) {
				changed = true;
				break;
			}
		}
		expect(changed).toBe(true);
		expect(Math.hypot(world.x - start.x, world.z - start.z)).toBeGreaterThan(30);
	});

	it('does not stay stuck off-road while throttle is held', () => {
		const world = createHaul(9);
		world.x += 22;
		world.z += 6;
		world.odometer = 80;
		setHaulControl(world, 'throttle', 1);
		for (let i = 0; i < 160; i++) stepHaul(world, 32);
		expect(world.onRoad).toBe(true);
		expect(world.recoverCount).toBeGreaterThan(0);
		expect(world.odometer).toBeGreaterThanOrEqual(80);
	});

	it('keeps a connected spine ahead and fork joints coincident', () => {
		const world = createHaul(7);
		simulateHaulMeters(world, 2800);
		for (let i = 0; i < 90; i++) {
			autoFollowHaul(world, 'main');
			stepHaul(world, 32);
		}
		expect(world.pieces.length).toBeLessThanOrEqual(ROAD_POOL);
		expect(haulSpineDepth(world)).toBeGreaterThanOrEqual(2);
		const gaps = haulJointGaps(world);
		expect(gaps.length).toBeGreaterThan(0);
		expect(Math.max(...gaps)).toBeLessThan(0.05);
		const here = world.pieces.find((p) => p.id === world.pieceId);
		expect(here).toBeTruthy();
		if (here?.parentId) {
			const parent = world.pieces.find((p) => p.id === here.parentId);
			if (parent && parent.exits.length >= 2) {
				const liveKids = parent.exits.filter((id) => world.pieces.some((p) => p.id === id));
				expect(liveKids.length).toBe(parent.exits.length);
			}
		}
	});

	it('ribbon left-then-right along -Z has +Y normals', () => {
		const right = haulRight(0);
		const ahead = haulAhead(0);
		const hw = 5;
		const p0 = { x: -right.x * hw, y: 0, z: -right.z * hw };
		const p1 = { x: right.x * hw, y: 0, z: right.z * hw };
		const p2 = { x: p0.x + ahead.x, y: 0, z: p0.z + ahead.z };
		const ny = (p1.z - p0.z) * (p2.x - p0.x) - (p1.x - p0.x) * (p2.z - p0.z);
		expect(ny).toBeGreaterThan(0);
	});

	it('yaw 0 ahead is world -Z and right is +X', () => {
		const a = haulAhead(0);
		const r = haulRight(0);
		expect(a.z).toBeCloseTo(-1);
		expect(a.x).toBeCloseTo(0);
		expect(r.x).toBeCloseTo(1);
		expect(r.z).toBeCloseTo(0);
		expect(a.x * r.z - a.z * r.x).toBeCloseTo(1);
	});

	it('yaw 0 road and drive travel world -Z with driver right at +X', () => {
		const world = createHaul(1);
		const first = world.pieces[0]!;
		expect(first.endZ).toBeLessThan(first.startZ - 8);
		expect(first.endX).toBeCloseTo(first.startX, 1);
		world.yaw = 0;
		world.steer = 0;
		world.steerInput = 0;
		world.speed = 12;
		const z0 = world.z;
		setHaulControl(world, 'throttle', 1);
		stepHaul(world, 400);
		expect(world.z).toBeLessThan(z0 - 1);
	});

	it('drive steer +1 moves toward driver +X right', () => {
		const world = createHaul(3);
		world.speed = 12;
		world.gear = 'drive';
		const start = { x: world.x, z: world.z, yaw: world.yaw };
		const rightX = Math.cos(start.yaw);
		const rightZ = Math.sin(start.yaw);
		setHaulControl(world, 'steer', 1);
		setHaulControl(world, 'throttle', 1);
		stepHaul(world, 700);
		const dRight = (world.x - start.x) * rightX + (world.z - start.z) * rightZ;
		expect(dRight).toBeGreaterThan(0.4);
	});

	it('reverse steer +1 sends the rear toward driver +X right', () => {
		const world = createHaul(3);
		world.speed = -7;
		world.gear = 'reverse';
		const start = { x: world.x, z: world.z, yaw: world.yaw };
		const rightX = Math.cos(start.yaw);
		const rightZ = Math.sin(start.yaw);
		setHaulControl(world, 'steer', 1);
		setHaulControl(world, 'throttle', 1);
		stepHaul(world, 700);
		const dRight = (world.x - start.x) * rightX + (world.z - start.z) * rightZ;
		expect(dRight).toBeGreaterThan(0.15);
	});

	it('recovers off-road without resetting the odometer', () => {
		const world = createHaul(9);
		world.odometer = 1234;
		world.x += 40;
		world.z += 40;
		world.speed = 0;
		world.stuckT = 4000;
		world.offRoadT = 4000;
		recoverHaul(world);
		expect(world.onRoad).toBe(true);
		expect(world.odometer).toBe(1234);
		expect(world.recoverCount).toBeGreaterThan(0);
		expect(Math.hypot(world.x, world.z)).toBeLessThan(30);
	});
});

import { describe, expect, it } from 'vitest';
import {
	BULLET_POOL,
	SHARD_POOL,
	fireSkyCannon,
	flyAimAlongRay,
	rebuildCloud,
	stepCannon
} from './cannon';
import { createSky, releaseSkyControls, setSkyKey, setSkySteer } from './sim';

describe('cloud fly aim and cannon', () => {
	it('flyAimAlongRay never returns a y≈0 disk in front of home', () => {
		const p = flyAimAlongRay({ x: 0, y: 5, z: 0 }, { x: 0, y: 0, z: 1 }, 14);
		expect(p.y).toBeCloseTo(5, 5);
		expect(p.z).toBeCloseTo(14, 5);
		expect(p.y).not.toBeCloseTo(0.1, 1);
		expect(Math.hypot(p.x, p.y - 5, p.z)).toBeCloseTo(14, 5);
	});

	it('releaseSkyControls clears keys, steer, and fire', () => {
		const world = createSky();
		setSkyKey(world, 'up', true);
		setSkySteer(world, 4, 2, 4);
		world.fireHeld = true;
		releaseSkyControls(world);
		expect(world.keys.up).toBe(false);
		expect(world.steer).toBeNull();
		expect(world.fireHeld).toBe(false);
	});

	it('13th bullet reuses slot 0', () => {
		const world = createSky();
		const origin = { x: 0, y: 2, z: 0 };
		const dir = { x: 0, y: 0, z: 1 };
		const first = fireSkyCannon(world, origin, dir, 0);
		for (let i = 1; i < 12; i++) fireSkyCannon(world, origin, dir, i * 10);
		const again = fireSkyCannon(world, origin, dir, 200);
		expect(world.bullets).toHaveLength(BULLET_POOL);
		expect(again).toBe(world.bullets[0]);
		expect(first).toBe(world.bullets[0]);
		expect(again.live).toBe(true);
	});

	it('hides a breakable island and rebuild restores pools and pose', () => {
		const world = createSky();
		const targets = [{ id: 'isle-1', x: 12, y: 1.2, z: 0.4, r: 3 }];
		fireSkyCannon(world, { x: 12, y: 1.2, z: -4 }, { x: 0, y: 0, z: 1 }, 0);
		stepCannon(world, 400, 400, targets);
		expect(world.hiddenIds).toContain('isle-1');
		const liveShards = world.shards.filter((s) => s.live);
		expect(liveShards.length).toBeGreaterThan(0);
		expect(liveShards.length).toBeLessThanOrEqual(8);
		expect(world.shards.length).toBeLessThanOrEqual(SHARD_POOL);
		const pose = { x: world.x, y: world.y, z: world.z };
		rebuildCloud(world);
		expect(world.hiddenIds).toEqual([]);
		expect(world.bullets.every((b) => !b.live)).toBe(true);
		expect(world.shards.every((s) => !s.live)).toBe(true);
		expect(world.x).toBe(pose.x);
		expect(world.y).toBe(pose.y);
		const protectedWell = [{ id: 'well', x: 0.2, y: 0, z: -0.55, r: 2.2, protect: true }];
		fireSkyCannon(world, { x: 0.2, y: 1, z: -6 }, { x: 0, y: 0, z: 1 }, 0);
		stepCannon(world, 800, 800, protectedWell);
		expect(world.hiddenIds).not.toContain('well');
	});
});

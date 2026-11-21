import { describe, expect, it } from 'vitest';
import { elevatorOf, standFor, stationById } from './floors';
import { followPath, inElevatorZone, interact, setDestination, tryMove } from './input';
import { fillJobProgress } from './jobs';
import { createWorld } from './sim';
import { acceptTask } from './tasks';

describe('上班 input', () => {
	it('rejects walking into a blocked bay and allows the aisle', () => {
		const world = createWorld({ seed: 8 });
		world.player.x = 7;
		world.player.z = 2;
		expect(tryMove(world, 1, 0, 1)).toBe(false);
		expect(world.player.x).toBe(7);
		expect(tryMove(world, -1, 0, 1)).toBe(true);
		expect(world.player.x).toBe(6);
	});

	it('picks and places a sort package through interact', () => {
		const world = createWorld({ seed: 1 });
		const offer = world.tasks[0];
		if (!offer) throw new Error('offer');
		acceptTask(world, offer.id);
		const inbound = stationById('inbound')!;
		world.player.x = inbound.x;
		world.player.z = inbound.z;
		expect(interact(world)).toBe(true);
		expect(world.player.carrying).toBeTruthy();
		fillJobProgress(world);
		const box = world.packages.find((item) => item.id === world.player.carrying);
		if (!box) throw new Error('box');
		const bay = stationById(`bay-${box.dest.toLowerCase()}`)!;
		world.player.x = bay.x + 1;
		world.player.z = bay.z;
		expect(interact(world)).toBe(true);
		expect(offer.status).toBe('done');
	});

	it('walks a carried package from inbound to the matching bay', () => {
		const world = createWorld({ seed: 1 });
		const offer = world.tasks[0];
		if (!offer) throw new Error('offer');
		acceptTask(world, offer.id);
		const inbound = stationById('inbound')!;
		world.player.x = inbound.x;
		world.player.z = inbound.z;
		expect(interact(world)).toBe(true);
		fillJobProgress(world);
		const box = world.packages.find((item) => item.id === world.player.carrying);
		if (!box) throw new Error('box');
		const bay = stationById(`bay-${box.dest.toLowerCase()}`)!;
		const stand = standFor(bay);
		setDestination(world, stand.x, stand.z);
		expect(world.player.path.length).toBeGreaterThan(0);
		for (let i = 0; i < 500; i++) {
			if (!followPath(world)) break;
		}
		expect(world.player.path.length).toBe(0);
		expect(interact(world)).toBe(true);
		expect(offer.status).toBe('done');
	});

	it('detects the elevator zone', () => {
		const world = createWorld({ seed: 2 });
		const elevator = elevatorOf(1);
		world.player.x = elevator.x;
		world.player.z = elevator.z;
		expect(inElevatorZone(world)).toBe(true);
		world.player.x = 9;
		world.player.z = 8;
		expect(inElevatorZone(world)).toBe(false);
	});

	it('does not move while riding or on a break', () => {
		const world = createWorld({ seed: 3 });
		world.player.elevatorTo = 5;
		world.player.elevatorWait = 4;
		const x = world.player.x;
		expect(tryMove(world, 1, 0, 1)).toBe(false);
		expect(world.player.x).toBe(x);
		world.player.elevatorTo = null;
		world.player.breakUntil = world.tick + 10;
		expect(tryMove(world, 1, 0, 1)).toBe(false);
	});
});

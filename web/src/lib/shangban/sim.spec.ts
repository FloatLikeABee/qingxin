import { describe, expect, it } from 'vitest';
import { elevatorOf } from './floors';
import {
	MAX_NPCS,
	MAX_STEPS_PER_FRAME,
	NPC_COUNT,
	callElevator,
	createWorld,
	setPaused,
	setRole,
	spawnOffers,
	startBreak,
	stepWorld,
	tickWorld
} from './sim';
import { acceptTask, declineTask } from './tasks';

describe('上班 world', () => {
	it('starts on floor 1 as 物流员 with five departments and a first offer', () => {
		const world = createWorld({ seed: 1 });
		expect(world.player.roleId).toBe('courier');
		expect(world.player.floor).toBe(1);
		expect(Object.keys(world.company.departments).map(Number).sort()).toEqual([1, 2, 3, 4, 5]);
		expect(world.tasks.filter((task) => task.status === 'offered')).toHaveLength(1);
		expect(world.tasks[0]?.kind).toBe('sort');
		expect(world.npcs).toHaveLength(NPC_COUNT);
		expect(world.npcs.length).toBeLessThanOrEqual(MAX_NPCS);
	});

	it('caps elapsed ticks and ignores time while paused or hidden', () => {
		const world = createWorld({ seed: 2 });
		const start = world.tick;
		stepWorld(world, 5000);
		expect(world.tick - start).toBeLessThanOrEqual(MAX_STEPS_PER_FRAME);
		setPaused(world, true);
		const pausedAt = world.tick;
		stepWorld(world, 5000);
		expect(world.tick).toBe(pausedAt);
		setPaused(world, false);
		world.hidden = true;
		stepWorld(world, 5000);
		expect(world.tick).toBe(pausedAt);
	});

	it('keeps NPC phases on work or break and never exceeds the cap', () => {
		const world = createWorld({ seed: 3 });
		for (let i = 0; i < 200; i++) tickWorld(world);
		expect(world.npcs.length).toBeLessThanOrEqual(MAX_NPCS);
		expect(world.npcs.some((npc) => npc.phase === 'work' || npc.phase === 'break')).toBe(true);
	});

	it('role switch cancels work, drops packages, and does not teleport', () => {
		const world = createWorld({ seed: 4 });
		const offer = world.tasks[0];
		if (!offer) throw new Error('offer');
		acceptTask(world, offer.id);
		world.player.carrying = 'pkg-1';
		world.player.x = 4;
		world.player.z = 3;
		setRole(world, 'sales');
		expect(world.player.roleId).toBe('sales');
		expect(world.player.x).toBe(4);
		expect(world.player.z).toBe(3);
		expect(world.player.floor).toBe(1);
		expect(world.player.carrying).toBeNull();
		expect(offer.status).toBe('cancelled');
		tickWorld(world);
		expect(world.tasks.some((task) => task.kind === 'negotiate' && task.status === 'offered')).toBe(
			true
		);
		expect(
			world.tasks.filter((task) => task.status === 'offered' && task.kind === 'sort')
		).toHaveLength(0);
	});

	it('rides the elevator only from the shaft and arrives after the wait', () => {
		const world = createWorld({ seed: 5 });
		world.player.x = 8;
		world.player.z = 2;
		expect(callElevator(world, 5)).toBe(false);
		const elevator = elevatorOf(1);
		world.player.x = elevator.x;
		world.player.z = elevator.z;
		expect(callElevator(world, 5)).toBe(true);
		const wait = world.player.elevatorWait;
		for (let i = 0; i < wait; i++) tickWorld(world);
		expect(world.player.floor).toBe(5);
		expect(world.player.elevatorTo).toBeNull();
	});

	it('bounds the live queue and still spawns after a decline', () => {
		const world = createWorld({ seed: 6, spawnEvery: 1 });
		for (let i = 0; i < 20; i++) tickWorld(world);
		const live = world.tasks.filter(
			(task) => task.status === 'offered' || task.status === 'active'
		);
		expect(live.length).toBeLessThanOrEqual(3);
		const offered = world.tasks.find((task) => task.status === 'offered');
		if (!offered) throw new Error('offer');
		declineTask(world, offered.id);
		spawnOffers(world);
		for (let i = 0; i < 4; i++) tickWorld(world);
		expect(world.tasks.some((task) => task.status === 'offered' && task.id !== offered.id)).toBe(
			true
		);
	});

	it('optional break blocks work completion until it ends', () => {
		const world = createWorld({ seed: 7 });
		startBreak(world);
		expect(world.player.breakUntil).toBeGreaterThan(world.tick);
		const until = world.player.breakUntil;
		tickWorld(world);
		expect(world.player.breakUntil).toBe(until);
	});
});

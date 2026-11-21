import { describe, expect, it } from 'vitest';
import { elevatorOf } from './floors';
import { stationById } from './floors';
import { startPerform } from './jobs';
import {
	MAX_NPCS,
	MAX_STEP_MS,
	MAX_STEPS_PER_FRAME,
	NPC_COUNT,
	DAY_TICKS,
	beginNextDay,
	frameElapsedMs,
	callElevator,
	closeDay,
	createWorld,
	setPaused,
	setRole,
	spawnOffers,
	startBreak,
	stepWorld,
	tickWorld
} from './sim';
import { acceptTask, choosePart, declineTask, inspectFault } from './tasks';

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

	it('credits real frame gaps up to MAX_STEP_MS so 1x is not slower than the clock', () => {
		expect(frameElapsedMs(1000, 1083)).toBe(83);
		expect(frameElapsedMs(1000, 1016)).toBe(16);
		expect(frameElapsedMs(1000, 4000)).toBe(MAX_STEP_MS);
		expect(frameElapsedMs(2000, 1990)).toBe(0);
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

	it('role switch with dropActive cancels work, drops packages, and does not teleport', () => {
		const world = createWorld({ seed: 4 });
		const offer = world.tasks[0];
		if (!offer) throw new Error('offer');
		acceptTask(world, offer.id);
		world.player.carrying = 'pkg-1';
		world.player.x = 4;
		world.player.z = 3;
		setRole(world, 'sales', { dropActive: true });
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

	it('clears a leftover walk path when the elevator is called', () => {
		const world = createWorld({ seed: 5 });
		const elevator = elevatorOf(1);
		world.player.x = elevator.x;
		world.player.z = elevator.z;
		world.player.path = [{ x: 10, z: 8 }];
		expect(callElevator(world, 5)).toBe(true);
		expect(world.player.path).toHaveLength(0);
		const wait = world.player.elevatorWait;
		for (let i = 0; i < wait; i++) tickWorld(world);
		expect(world.player.floor).toBe(5);
		expect(world.player.path).toHaveLength(0);
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

	it('keeps a just-failed job after the history fills so 重试 stays available', () => {
		const world = createWorld({ seed: 31, spawnEvery: 1 });
		setRole(world, 'tech', { dropActive: true });
		const repair = stationById('repair')!;
		world.player.floor = 3;
		world.player.x = repair.x;
		world.player.z = repair.z;
		const offer = world.tasks.find((task) => task.status === 'offered' && task.roleId === 'tech');
		if (!offer) throw new Error('offer');
		acceptTask(world, offer.id);
		expect(startPerform(world)).toBe(true);
		if (offer.payload.kind !== 'repair') throw new Error('repair');
		expect(inspectFault(world)).toBe(true);
		const wrong = offer.payload.options.find((part) => part !== offer.payload.correctPart);
		expect(choosePart(world, wrong ?? '排线')).toBe(false);
		expect(offer.status).toBe('failed');
		for (let i = 0; i < 80; i++) tickWorld(world);
		expect(world.tasks.some((task) => task.status === 'failed' && task.roleId === 'tech')).toBe(
			true
		);
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

	it('does not carry an overnight break that freezes the next morning', () => {
		const world = createWorld({ seed: 41 });
		world.tick = 700;
		startBreak(world);
		expect(world.player.breakUntil).toBeGreaterThan(DAY_TICKS);
		closeDay(world);
		expect(beginNextDay(world)).toBe(true);
		expect(world.player.breakUntil).toBeLessThanOrEqual(world.tick);
		const inbound = stationById('inbound')!;
		world.player.x = inbound.x;
		world.player.z = inbound.z;
		const offer = world.tasks.find(
			(task) => task.status === 'offered' && task.roleId === 'courier'
		);
		if (!offer) throw new Error('offer');
		acceptTask(world, offer.id);
		expect(startPerform(world)).toBe(true);
		const spent = offer.ticksSpent;
		tickWorld(world);
		expect(offer.ticksSpent).toBeGreaterThan(spent);
	});
});

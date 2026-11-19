import { describe, expect, it } from 'vitest';
import { stationById } from './floors';
import { atWorkstation, fillJobProgress, startPerform } from './jobs';
import { ROLES, type RoleId } from './roles';
import {
	beginNextDay,
	closeDay,
	createWorld,
	setPaused,
	setRole,
	setSpeed,
	stepWorld,
	tickWorld
} from './sim';
import {
	JOB_DURATION,
	acceptTask,
	chooseDecision,
	choosePart,
	chooseShip,
	inspectFault,
	judgeClaim,
	moveResource,
	offerPrice,
	pickPackage,
	placePackage
} from './tasks';

function seat(world: ReturnType<typeof createWorld>, role: RoleId) {
	const roleDef = ROLES.find((item) => item.id === role)!;
	const station = stationById(
		role === 'courier'
			? 'inbound'
			: role === 'sales'
				? 'negotiate'
				: role === 'tech'
					? 'repair'
					: role === 'engineer'
						? 'test'
						: role === 'finance'
							? 'payroll'
							: role === 'manager'
								? 'board'
								: 'office'
	)!;
	world.player.floor = roleDef.floor;
	world.player.x = station.x;
	world.player.z = station.z;
}

function take(world: ReturnType<typeof createWorld>, role: RoleId) {
	if (world.player.roleId !== role) setRole(world, role, { dropActive: true });
	seat(world, role);
	const offer =
		world.tasks.find((task) => task.status === 'offered' && task.roleId === role) ??
		world.tasks.find((task) => task.roleId === role);
	if (!offer) throw new Error('offer');
	if (offer.status === 'offered') acceptTask(world, offer.id);
	expect(startPerform(world)).toBe(true);
	return offer;
}

describe('上班 staged jobs', () => {
	it('blocks start away from the workstation and does not require held keys', () => {
		const world = createWorld({ seed: 21 });
		const offer = world.tasks[0]!;
		acceptTask(world, offer.id);
		world.player.x = 10;
		world.player.z = 8;
		expect(startPerform(world)).toBe(false);
		expect(offer.stage).toBe('prepare');
		seat(world, 'courier');
		expect(startPerform(world)).toBe(true);
		expect(offer.stage).toBe('perform');
	});

	it('pauses progress when walked away, paused, or hidden, and honors speed', () => {
		const world = createWorld({ seed: 22 });
		const task = take(world, 'courier');
		for (let i = 0; i < 10; i++) tickWorld(world);
		const mid = task.ticksSpent;
		expect(mid).toBeGreaterThan(0);
		world.player.x = 10;
		world.player.z = 8;
		for (let i = 0; i < 10; i++) tickWorld(world);
		expect(task.ticksSpent).toBe(mid);
		seat(world, 'courier');
		setPaused(world, true);
		tickWorld(world);
		expect(task.ticksSpent).toBe(mid);
		setPaused(world, false);
		world.hidden = true;
		tickWorld(world);
		expect(task.ticksSpent).toBe(mid);
		world.hidden = false;
		const fast = createWorld({ seed: 23 });
		take(fast, 'courier');
		setSpeed(fast, 3);
		const slow = createWorld({ seed: 23 });
		take(slow, 'courier');
		stepWorld(slow, 250);
		stepWorld(fast, 250);
		expect(fast.tasks[0]!.ticksSpent).toBeGreaterThan(slow.tasks[0]!.ticksSpent);
		expect(JOB_DURATION.engineer).toBeGreaterThan(JOB_DURATION.courier);
	});

	it('courier pick/place only pays once after progress', () => {
		const world = createWorld({ seed: 1 });
		const task = take(world, 'courier');
		const box = world.packages[0]!;
		expect(pickPackage(world, box.id)).toBe(true);
		expect(world.player.pay).toBe(0);
		expect(placePackage(world, box.dest)).toBe(false);
		fillJobProgress(world);
		expect(placePackage(world, box.dest)).toBe(true);
		expect(task.status).toBe('done');
		const pay = world.player.pay;
		expect(placePackage(world, box.dest)).toBe(false);
		expect(world.player.pay).toBe(pay);
	});

	it('sales quote is a checkpoint and submit pays once', () => {
		const world = createWorld({ seed: 30 });
		const task = take(world, 'sales');
		if (task.payload.kind !== 'negotiate') throw new Error('neg');
		task.payload.hiddenMax = 140;
		expect(offerPrice(world, 'fair')).toBe(false);
		expect(task.status).toBe('active');
		fillJobProgress(world);
		expect(offerPrice(world, 'fair')).toBe(true);
		expect(task.payAwarded).toBe(true);
		const pay = world.player.pay;
		expect(offerPrice(world, 'fair')).toBe(false);
		expect(world.player.pay).toBe(pay);
	});

	it('repair inspect then part after progress', () => {
		const world = createWorld({ seed: 31 });
		const task = take(world, 'tech');
		if (task.payload.kind !== 'repair') throw new Error('repair');
		expect(choosePart(world, task.payload.correctPart)).toBe(false);
		expect(inspectFault(world)).toBe(true);
		fillJobProgress(world);
		expect(choosePart(world, task.payload.correctPart)).toBe(true);
		expect(task.status).toBe('done');
	});

	it('engineer plan then submit; high ship still fails immediately', () => {
		const world = createWorld({ seed: 32 });
		const task = take(world, 'engineer');
		if (task.payload.kind !== 'ship') throw new Error('ship');
		task.payload.severity = 'high';
		task.payload.fault = 'bug';
		expect(chooseShip(world, 'ship')).toBe(false);
		expect(task.status).toBe('failed');
		const ok = createWorld({ seed: 33 });
		const safe = take(ok, 'engineer');
		if (safe.payload.kind !== 'ship') throw new Error('ship');
		safe.payload.severity = 'high';
		expect(chooseShip(ok, 'test')).toBe(false);
		fillJobProgress(ok);
		expect(chooseShip(ok, 'test')).toBe(true);
	});

	it('finance/manager/ceo wait for progress then submit', () => {
		const finance = createWorld({ seed: 34 });
		const audit = take(finance, 'finance');
		if (audit.payload.kind !== 'audit') throw new Error('audit');
		audit.payload.amount = 60;
		audit.payload.category = '餐补';
		audit.payload.hasReceipt = true;
		audit.payload.flagged = false;
		expect(judgeClaim(finance, 'approve')).toBe(false);
		fillJobProgress(finance);
		expect(judgeClaim(finance, 'approve')).toBe(true);

		const manager = createWorld({ seed: 35 });
		take(manager, 'manager');
		expect(moveResource(manager, 3, 1, 'staff')).toBe(false);
		fillJobProgress(manager);
		expect(moveResource(manager, 3, 1, 'staff')).toBe(true);

		const ceo = createWorld({ seed: 36 });
		const decide = take(ceo, 'ceo');
		if (decide.payload.kind !== 'decide') throw new Error('decide');
		expect(chooseDecision(ceo, decide.payload.options[0]!.id)).toBe(false);
		fillJobProgress(ceo);
		expect(chooseDecision(ceo, decide.payload.options[0]!.id)).toBe(true);
	});

	it('role switch refuses silent drop and dropActive cancels without pay', () => {
		const world = createWorld({ seed: 37 });
		const task = take(world, 'courier');
		fillJobProgress(world);
		const pay = world.player.pay;
		expect(setRole(world, 'sales')).toBe(false);
		expect(world.player.roleId).toBe('courier');
		expect(task.status).toBe('active');
		expect(setRole(world, 'sales', { dropActive: true })).toBe(true);
		expect(world.player.roleId).toBe('sales');
		expect(task.status).toBe('cancelled');
		expect(world.player.pay).toBe(pay);
	});

	it('unfinished work carries to the next day', () => {
		const world = createWorld({ seed: 38 });
		const task = take(world, 'courier');
		for (let i = 0; i < 12; i++) tickWorld(world);
		const spent = task.ticksSpent;
		closeDay(world);
		beginNextDay(world);
		expect(task.status).toBe('active');
		expect(task.ticksSpent).toBe(spent);
		expect(atWorkstation(world)).toBe(true);
	});
});

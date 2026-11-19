import { describe, expect, it } from 'vitest';
import { stationById } from './floors';
import { fillJobProgress, startPerform } from './jobs';
import { ROLES, type FloorId, type RoleId } from './roles';
import {
	JOB_STATION,
	acceptTask,
	chooseDecision,
	choosePart,
	chooseShip,
	declineTask,
	generateTask,
	inspectFault,
	judgeClaim,
	moveResource,
	offerPrice,
	pickPackage,
	placePackage,
	retryTask,
	shouldApproveClaim,
	type WorkState
} from './tasks';

function dept() {
	return { workload: 40, staff: 4, budget: 40 };
}

function host(role: RoleId = 'courier'): WorkState {
	const departments = {
		1: dept(),
		2: dept(),
		3: dept(),
		4: dept(),
		5: dept()
	} as WorkState['company']['departments'];
	const station = stationById(JOB_STATION[role])!;
	return {
		tick: 4,
		notice: '',
		player: {
			roleId: role,
			floor: ROLES.find((item) => item.id === role)!.floor,
			x: station.x,
			z: station.z,
			pay: 20,
			reputation: 10,
			carrying: null
		},
		company: { cash: 200, reputation: 50, morale: 50, departments },
		tasks: [],
		packages: [],
		nextId: 1,
		rng: () => 0.1,
		dayEvents: []
	};
}

function arm(world: WorkState) {
	const task = world.tasks[0];
	if (!task) throw new Error('task');
	if (task.status === 'offered') acceptTask(world, task.id);
	startPerform(world);
	fillJobProgress(world);
}

describe('上班 tasks', () => {
	it('generates the matching kind for every role', () => {
		for (const role of ROLES) {
			const task = generateTask(role.id, () => 0.2, 0, 1);
			expect(task.kind).toBe(role.kind);
			expect(task.roleId).toBe(role.id);
			expect(task.status).toBe('offered');
		}
	});

	it('sorts a package to the matching bay and punishes a wrong bay', () => {
		const world = host('courier');
		const task = generateTask('courier', () => 0, 0, 1);
		world.tasks = [task];
		acceptTask(world, task.id);
		expect(task.payload.kind).toBe('sort');
		if (task.payload.kind !== 'sort') throw new Error('sort');
		const box = task.payload.boxes[0];
		if (!box) throw new Error('box');
		world.packages = [{ ...box }];
		arm(world);
		expect(pickPackage(world, box.id)).toBe(true);
		expect(world.player.carrying).toBe(box.id);
		const wrong: 'A' | 'B' | 'C' = box.dest === 'A' ? 'B' : 'A';
		const failed = host('courier');
		failed.tasks = [structuredClone(task)];
		failed.packages = [{ ...box, held: false }];
		failed.player.carrying = box.id;
		failed.packages[0]!.held = true;
		arm(failed);
		expect(placePackage(failed, wrong)).toBe(false);
		expect(failed.tasks[0]?.status).toBe('failed');
		expect(failed.company.departments[1]?.workload).toBeGreaterThan(40);

		const ok = host('courier');
		ok.tasks = [structuredClone(task)];
		ok.tasks[0]!.status = 'active';
		ok.packages = [{ ...box, held: false }];
		ok.player.carrying = box.id;
		ok.packages[0]!.held = true;
		arm(ok);
		ok.player.carrying = box.id;
		ok.packages[0]!.held = true;
		expect(placePackage(ok, box.dest)).toBe(true);
		expect(ok.tasks[0]?.status).toBe('done');
		expect(ok.player.pay).toBeGreaterThan(20);
		expect(ok.company.departments[1]?.workload).toBeLessThan(40);
	});

	it('negotiate high offer fails when the hidden max is low', () => {
		const world = host('sales');
		const task = generateTask('sales', () => 0, 0, 2);
		if (task.payload.kind !== 'negotiate') throw new Error('neg');
		task.payload.hiddenMax = 90;
		task.payload.patience = 1;
		world.tasks = [task];
		arm(world);
		expect(offerPrice(world, 'high')).toBe(false);
		expect(task.status).toBe('failed');
		task.status = 'active';
		task.stage = 'submit';
		task.progress = 1;
		task.payAwarded = false;
		task.payload.patience = 3;
		task.payload.hiddenMax = 140;
		expect(offerPrice(world, 'high')).toBe(true);
		expect(task.status).toBe('done');
	});

	it('repair inspects then accepts only the correct part', () => {
		const world = host('tech');
		const task = generateTask('tech', () => 0, 0, 3);
		if (task.payload.kind !== 'repair') throw new Error('repair');
		world.tasks = [task];
		arm(world);
		expect(inspectFault(world)).toBe(true);
		expect(task.payload.clue).toBeTruthy();
		const wrong = task.payload.options.find((part) => part !== task.payload.correctPart)!;
		expect(choosePart(world, wrong)).toBe(false);
		expect(task.status).toBe('failed');
		task.status = 'active';
		task.stage = 'submit';
		task.progress = 1;
		task.payAwarded = false;
		expect(inspectFault(world)).toBe(true);
		expect(choosePart(world, task.payload.correctPart)).toBe(true);
		expect(task.status).toBe('done');
	});

	it('ship test always lands, ship fails on high severity, rewrite needs design', () => {
		const high = host('engineer');
		const ticket = generateTask('engineer', () => 0.9, 0, 4);
		if (ticket.payload.kind !== 'ship') throw new Error('ship');
		ticket.payload.severity = 'high';
		ticket.payload.fault = 'bug';
		high.tasks = [ticket];
		arm(high);
		expect(chooseShip(high, 'ship')).toBe(false);
		const tested = host('engineer');
		const safe = generateTask('engineer', () => 0, 0, 5);
		if (safe.payload.kind !== 'ship') throw new Error('ship');
		safe.payload.severity = 'high';
		tested.tasks = [safe];
		arm(tested);
		expect(chooseShip(tested, 'test')).toBe(true);
		const rewrite = host('engineer');
		const design = generateTask('engineer', () => 0, 0, 6);
		if (design.payload.kind !== 'ship') throw new Error('ship');
		design.payload.fault = 'design';
		rewrite.tasks = [design];
		arm(rewrite);
		expect(chooseShip(rewrite, 'rewrite')).toBe(true);
		const bugRewrite = host('engineer');
		const bug = generateTask('engineer', () => 0, 0, 7);
		if (bug.payload.kind !== 'ship') throw new Error('bug');
		bug.payload.fault = 'bug';
		bugRewrite.tasks = [bug];
		arm(bugRewrite);
		expect(chooseShip(bugRewrite, 'rewrite')).toBe(false);
	});

	it('audits claims against printed rules', () => {
		expect(
			shouldApproveClaim({ amount: 90, category: '餐补', hasReceipt: true, flagged: false })
		).toBe(false);
		expect(
			shouldApproveClaim({ amount: 60, category: '餐补', hasReceipt: true, flagged: false })
		).toBe(true);
		expect(
			shouldApproveClaim({ amount: 120, category: '加班', hasReceipt: true, flagged: false })
		).toBe(false);
		const world = host('finance');
		const bad = generateTask('finance', () => 0.99, 0, 8);
		if (bad.payload.kind !== 'audit') throw new Error('audit');
		bad.payload.amount = 90;
		bad.payload.category = '餐补';
		bad.payload.hasReceipt = true;
		bad.payload.flagged = false;
		world.tasks = [bad];
		arm(world);
		expect(judgeClaim(world, 'approve')).toBe(false);
		expect(world.company.cash).toBeLessThan(200);
		const good = host('finance');
		const ok = generateTask('finance', () => 0, 0, 9);
		if (ok.payload.kind !== 'audit') throw new Error('audit');
		ok.payload.amount = 60;
		ok.payload.category = '餐补';
		ok.payload.hasReceipt = true;
		ok.payload.flagged = false;
		good.tasks = [ok];
		arm(good);
		expect(judgeClaim(good, 'approve')).toBe(true);
		const wrong = host('finance');
		const valid = generateTask('finance', () => 0, 0, 19);
		if (valid.payload.kind !== 'audit') throw new Error('audit');
		valid.payload.amount = 60;
		valid.payload.category = '餐补';
		valid.payload.hasReceipt = true;
		valid.payload.flagged = false;
		wrong.tasks = [valid];
		arm(wrong);
		expect(judgeClaim(wrong, 'reject')).toBe(false);
		expect(wrong.player.reputation).toBeLessThan(10);
	});

	it('allocates staff with visible floor effects and mishap if a floor is stripped', () => {
		const world = host('manager');
		const task = generateTask('manager', () => 0, 0, 10);
		world.tasks = [task];
		arm(world);
		const fromStaff = world.company.departments[3]!.staff;
		expect(moveResource(world, 3, 1, 'staff')).toBe(true);
		expect(world.company.departments[3]!.staff).toBe(fromStaff - 1);
		expect(world.company.departments[1]!.staff).toBe(5);
		expect(world.company.departments[1]!.workload).toBeLessThan(
			world.company.departments[3]!.workload
		);
		world.company.departments[2]!.staff = 1;
		const mishap = host('manager');
		mishap.tasks = [generateTask('manager', () => 0, 0, 11)];
		arm(mishap);
		mishap.company.departments[2]!.staff = 1;
		expect(moveResource(mishap, 2, 1, 'staff')).toBe(false);
		expect(mishap.company.departments[2]!.staff).toBe(1);
		expect(mishap.notice).toContain('编制');
	});

	it('CEO decisions change at least two company meters and differ by option', () => {
		const a = host('ceo');
		const b = host('ceo');
		const taskA = generateTask('ceo', () => 0, 0, 12);
		const taskB = generateTask('ceo', () => 0, 0, 13);
		a.tasks = [taskA];
		b.tasks = [taskB];
		arm(a);
		arm(b);
		if (taskA.payload.kind !== 'decide' || taskB.payload.kind !== 'decide')
			throw new Error('decide');
		const first = taskA.payload.options[0]!;
		const second = taskA.payload.options[1]!;
		expect(chooseDecision(a, first.id)).toBe(true);
		expect(chooseDecision(b, second.id)).toBe(true);
		const changedA = [
			a.company.cash !== 200,
			a.company.morale !== 50,
			a.company.reputation !== 50,
			Object.values(a.company.departments).some((d) => d.workload !== 40)
		].filter(Boolean).length;
		expect(changedA).toBeGreaterThanOrEqual(2);
		expect(a.company).not.toEqual(b.company);
	});

	it('decline removes an offer and retry reopens a failed task of the same kind', () => {
		const world = host('courier');
		const task = generateTask('courier', () => 0, 0, 14);
		world.tasks = [task];
		expect(declineTask(world, task.id)).toBe(true);
		expect(task.status).toBe('declined');
		const failed = host('sales');
		const lost = generateTask('sales', () => 0, 0, 15);
		failed.tasks = [lost];
		acceptTask(failed, lost.id);
		lost.status = 'failed';
		expect(retryTask(failed, lost.id)).toBe(true);
		expect(lost.status).toBe('offered');
		expect(lost.kind).toBe('negotiate');
	});
});

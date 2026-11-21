import { describe, expect, it } from 'vitest';
import { SHANGBAN_SAVE_KEY, SHANGBAN_SCHEMA, readShangbanSave, writeShangbanSave } from './persist';
import { closeDay, createWorld, setRole } from './sim';
import { acceptTask } from './tasks';

function memory(initial?: Record<string, string>) {
	const data = new Map<string, string>(Object.entries(initial ?? {}));
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => {
			data.set(key, value);
		},
		removeItem: (key: string) => {
			data.delete(key);
		},
		has: (key: string) => data.has(key)
	};
}

describe('上班 save', () => {
	it('round-trips role, floor, pay, and the active task', () => {
		const storage = memory();
		const world = createWorld({ seed: 11 });
		setRole(world, 'finance');
		world.player.floor = 4;
		world.player.pay = 44;
		world.player.x = 5;
		world.player.z = 4;
		const offer = world.tasks.find((task) => task.status === 'offered');
		if (offer) acceptTask(world, offer.id);
		writeShangbanSave(world, storage);
		const loaded = readShangbanSave(storage);
		expect(loaded.recovered).toBe(false);
		expect(loaded.player.roleId).toBe('finance');
		expect(loaded.player.floor).toBe(4);
		expect(loaded.player.pay).toBe(44);
		expect(loaded.tasks.some((task) => task.status === 'active' && task.kind === 'audit')).toBe(
			true
		);
		expect(SHANGBAN_SCHEMA).toBe(2);
		expect(SHANGBAN_SAVE_KEY).toBe('qingxin.shangban');
	});

	it('recovers from corrupt JSON without deleting sibling saves', () => {
		const storage = memory({
			'qingxin.games.window-garden': '{"schema":3,"coins":9}',
			[SHANGBAN_SAVE_KEY]: '{nope'
		});
		const loaded = readShangbanSave(storage);
		expect(loaded.recovered).toBe(true);
		expect(loaded.player.roleId).toBe('courier');
		expect(storage.getItem('qingxin.games.window-garden')).toBe('{"schema":3,"coins":9}');
		expect(storage.getItem(SHANGBAN_SAVE_KEY)).toBe('{nope');
	});

	it('round-trips NPC collar looks', () => {
		const storage = memory();
		const world = createWorld({ seed: 12 });
		if (!world.npcs[0]) throw new Error('npc');
		world.npcs[0].look = 'manager';
		writeShangbanSave(world, storage);
		const loaded = readShangbanSave(storage);
		expect(loaded.npcs[0]?.look).toBe('manager');
	});

	it('migrates a schema 1 save without wiping role, pay, or the active task', () => {
		const storage = memory();
		storage.setItem(
			SHANGBAN_SAVE_KEY,
			JSON.stringify({
				schema: 1,
				tick: 40,
				seed: 11,
				notice: '旧档',
				player: {
					roleId: 'finance',
					floor: 4,
					x: 5,
					z: 3,
					facing: 0,
					pay: 44,
					reputation: 12,
					carrying: null,
					breakUntil: 0,
					elevatorTo: null,
					elevatorWait: 0,
					path: []
				},
				company: {
					cash: 200,
					reputation: 50,
					morale: 50,
					departments: {
						1: { workload: 36, staff: 4, budget: 40 },
						2: { workload: 36, staff: 4, budget: 40 },
						3: { workload: 36, staff: 4, budget: 40 },
						4: { workload: 40, staff: 4, budget: 40 },
						5: { workload: 36, staff: 4, budget: 40 }
					}
				},
				tasks: [
					{
						id: 2,
						roleId: 'finance',
						kind: 'audit',
						status: 'active',
						title: '核 餐补 ¥60',
						detail: '旧',
						offeredAt: 0,
						deadline: 180,
						payload: {
							kind: 'audit',
							amount: 60,
							category: '餐补',
							hasReceipt: true,
							flagged: false
						}
					}
				],
				packages: [],
				npcs: [],
				nextId: 3,
				lastSpawnAt: 0,
				spawnEvery: 24
			})
		);
		const loaded = readShangbanSave(storage);
		expect(loaded.recovered).toBe(false);
		expect(loaded.player.roleId).toBe('finance');
		expect(loaded.player.pay).toBe(44);
		expect(loaded.player.floor).toBe(4);
		expect(loaded.day).toBe(1);
		expect(loaded.logs).toEqual([]);
		expect(loaded.tasks.some((task) => task.status === 'active' && task.kind === 'audit')).toBe(
			true
		);
		expect(loaded.tasks.find((task) => task.status === 'active')?.stage).toBe('perform');
		expect(storage.getItem(SHANGBAN_SAVE_KEY)).toContain('"schema":1');
	});

	it('reloads mid-task progress and an already closed day without duplicating logs', () => {
		const storage = memory();
		const world = createWorld({ seed: 8 });
		setRole(world, 'tech', { dropActive: true });
		const offer = world.tasks.find((task) => task.status === 'offered');
		if (offer) acceptTask(world, offer.id);
		const active = world.tasks.find((task) => task.status === 'active')!;
		active.stage = 'perform';
		active.ticksSpent = 20;
		active.progress = 20 / active.durationTicks;
		writeShangbanSave(world, storage);
		const mid = readShangbanSave(storage);
		expect(mid.tasks.find((task) => task.status === 'active')?.ticksSpent).toBe(20);
		expect(mid.dayClosed).toBe(false);

		world.player.pay = 18;
		closeDay(world);
		writeShangbanSave(world, storage);
		const closed = readShangbanSave(storage);
		expect(closed.dayClosed).toBe(true);
		expect(closed.logs).toHaveLength(1);
		expect(closed.paused).toBe(true);
		closeDay(closed);
		expect(closed.logs).toHaveLength(1);
	});

	it('round-trips a stored ship plan so reload still submits when the bar fills', () => {
		const storage = memory();
		const world = createWorld({ seed: 33 });
		setRole(world, 'engineer', { dropActive: true });
		const offer = world.tasks.find((task) => task.status === 'offered');
		if (!offer) throw new Error('offer');
		acceptTask(world, offer.id);
		offer.stage = 'perform';
		if (offer.payload.kind !== 'ship') throw new Error('ship');
		offer.payload.severity = 'high';
		offer.payload.chosen = 'test';
		offer.pendingAction = { type: 'ship', action: 'test' };
		offer.checkpoints = offer.checkpoints.map((item) => ({ ...item, done: true }));
		writeShangbanSave(world, storage);
		const loaded = readShangbanSave(storage);
		const task = loaded.tasks.find((item) => item.status === 'active');
		expect(task?.pendingAction).toEqual({ type: 'ship', action: 'test' });
		expect(task?.payload.kind === 'ship' && task.payload.chosen).toBe('test');
	});

	it('clears a leftover overnight break on a resumed day-2 save', () => {
		const storage = memory();
		const world = createWorld({ seed: 9 });
		world.day = 2;
		world.tick = 0;
		world.player.breakUntil = 730;
		writeShangbanSave(world, storage);
		const loaded = readShangbanSave(storage);
		expect(loaded.recovered).toBe(false);
		expect(loaded.player.breakUntil).toBeLessThanOrEqual(loaded.tick);
		expect(storage.getItem('qingxin.theme') ?? null).toBeNull();
	});

	it('recovers unknown schema and missing keys as a fresh courier world', () => {
		const missing = readShangbanSave(memory());
		expect(missing.player.roleId).toBe('courier');
		expect(missing.recovered).toBe(false);
		const weird = readShangbanSave(
			memory({ [SHANGBAN_SAVE_KEY]: JSON.stringify({ schema: 99, pay: 8 }) })
		);
		expect(weird.recovered).toBe(true);
		expect(weird.notice).toContain('存档');
	});
});

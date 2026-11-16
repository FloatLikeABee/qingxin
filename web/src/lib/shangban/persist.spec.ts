import { describe, expect, it } from 'vitest';
import { SHANGBAN_SAVE_KEY, SHANGBAN_SCHEMA, readShangbanSave, writeShangbanSave } from './persist';
import { createWorld, setRole } from './sim';
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
		expect(SHANGBAN_SCHEMA).toBe(1);
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

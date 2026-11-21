import { describe, expect, it } from 'vitest';
import { createShelf, pickItem, placeHeld, shelfLayout, stepShelf } from './sim';
import { SHELF_SAVE_KEY, SHELF_SCHEMA, readShelfSave, writeShelfSave } from './persist';

function memory(initial?: Record<string, string>) {
	const data = new Map<string, string>(Object.entries(initial ?? {}));
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => {
			data.set(key, value);
		}
	};
}

describe('memory-shelf save', () => {
	it('round-trips arrangement, round, and haunt without wiping other keys', () => {
		const storage = memory({
			'qingxin.theme': 'dark',
			'qingxin.games.tide-breath': '{"schema":1}'
		});
		const world = createShelf(() => 0.2);
		const haunt = world.hauntId;
		const other = world.items.find((i) => i.kind === 'book' && i.id !== haunt)!;
		const target = world.items.find((i) => i.id !== other.id && i.row === other.row)!;
		pickItem(world, other.id);
		placeHeld(world, target.row, target.slot);
		world.lowDetail = true;
		world.audioWanted = true;
		world.round = 2;
		writeShelfSave(world, storage);
		const loaded = readShelfSave(storage);
		expect(loaded.recovered).toBe(false);
		expect(shelfLayout(loaded)).toEqual(shelfLayout(world));
		expect(loaded.round).toBe(2);
		expect(loaded.hauntId).toBe(world.hauntId);
		expect(loaded.lowDetail).toBe(true);
		expect(loaded.audioWanted).toBe(true);
		expect(SHELF_SCHEMA).toBe(2);
		expect(SHELF_SAVE_KEY).toBe('qingxin.games.memory-shelf');
		expect(storage.getItem('qingxin.theme')).toBe('dark');
		expect(storage.getItem('qingxin.games.tide-breath')).toBe('{"schema":1}');
	});

	it('migrates schema 1 settings and starts a fresh shelf', () => {
		const storage = memory({
			'qingxin.theme': 'light',
			'qingxin.games.memory-shelf': JSON.stringify({
				schema: 1,
				puzzle: 2,
				phase: 'restore',
				lowDetail: true,
				audioWanted: true,
				dockCollapsed: true
			})
		});
		const loaded = readShelfSave(storage);
		expect(loaded.recovered).toBe(true);
		expect(loaded.lowDetail).toBe(true);
		expect(loaded.audioWanted).toBe(true);
		expect(loaded.dockCollapsed).toBe(true);
		expect(loaded.phase).toBe('idle');
		expect(loaded.notice).toMatch(/货架换了样子/);
		expect(storage.getItem('qingxin.theme')).toBe('light');
		const saved = JSON.parse(storage.getItem('qingxin.games.memory-shelf')!);
		expect(saved.schema).toBe(2);
		expect(saved.flash).toBe('migrated');
		const again = readShelfSave(storage);
		expect(again.notice).toMatch(/货架换了样子/);
		expect(again.lowDetail).toBe(true);
	});

	it('recovers a corrupt save without throwing', () => {
		const storage = memory({ 'qingxin.games.memory-shelf': '{nope' });
		const loaded = readShelfSave(storage);
		expect(loaded.recovered).toBe(true);
		expect(loaded.phase).toBe('idle');
		expect(loaded.notice).toMatch(/重新|换了/);
	});

	it('ignores a foreign schema instead of wiping other keys', () => {
		const storage = memory({
			'qingxin.theme': 'dark',
			'qingxin.games.memory-shelf': JSON.stringify({ schema: 99, puzzle: 3 })
		});
		const loaded = readShelfSave(storage);
		expect(loaded.recovered).toBe(true);
		expect(loaded.round).toBe(0);
		expect(storage.getItem('qingxin.theme')).toBe('dark');
	});
});

import { describe, expect, it } from 'vitest';
import {
	applyTable,
	createShelf,
	hauntIdsOf,
	pickItem,
	placeHeld,
	shelfLayout,
	visibleItems
} from './sim';
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
	it('round-trips arrangement, haunt ids, and settings without wiping other keys', () => {
		const storage = memory({
			'qingxin.theme': 'dark',
			'qingxin.games.tide-breath': '{"schema":1}',
			'qingxin.games.cargo-haul': '{"schema":2}',
			'qingxin.games.cloud-walk': '{"schema":3}',
			'qingxin.games.operation': '{"schema":2}'
		});
		const world = createShelf(() => 0.2);
		const busy = new Set(hauntIdsOf(world));
		const other = world.items.find((i) => i.kind === 'book' && !busy.has(i.id))!;
		const target = world.items.find((i) => i.id !== other.id && i.row === other.row)!;
		const tRow = target.row;
		const tSlot = target.slot;
		pickItem(world, other.id);
		placeHeld(world, tRow, tSlot);
		world.lowDetail = true;
		world.audioWanted = true;
		world.round = 2;
		writeShelfSave(world, storage);
		const loaded = readShelfSave(storage);
		expect(loaded.recovered).toBe(false);
		expect(shelfLayout(loaded)).toEqual(shelfLayout(world));
		expect(loaded.round).toBe(2);
		expect(loaded.lowDetail).toBe(true);
		expect(loaded.audioWanted).toBe(true);
		expect(SHELF_SCHEMA).toBe(3);
		expect(SHELF_SAVE_KEY).toBe('qingxin.games.memory-shelf');
		expect(storage.getItem('qingxin.theme')).toBe('dark');
		expect(storage.getItem('qingxin.games.tide-breath')).toBe('{"schema":1}');
		expect(storage.getItem('qingxin.games.cargo-haul')).toBe('{"schema":2}');
		expect(storage.getItem('qingxin.games.cloud-walk')).toBe('{"schema":3}');
		expect(storage.getItem('qingxin.games.operation')).toBe('{"schema":2}');
		const saved = JSON.parse(storage.getItem('qingxin.games.memory-shelf')!);
		expect(saved.schema).toBe(3);
		expect(Array.isArray(saved.hauntIds)).toBe(true);
		expect(saved.hauntId).toBeUndefined();
	});

	it('migrates schema 2 by id, keeps b0, and parks extra cells as fresh', () => {
		const storage = memory({
			'qingxin.theme': 'light',
			'qingxin.games.cargo-haul': '{"schema":2}',
			'qingxin.games.memory-shelf': JSON.stringify({
				schema: 2,
				items: [
					{
						id: 'b0',
						kind: 'book',
						title: '夜航',
						tone: 0.2,
						row: 1,
						slot: 2,
						tall: 0.5,
						thick: 0.25
					},
					{
						id: 'p0',
						kind: 'prop',
						title: '地球仪',
						prop: 'globe',
						tone: 0.1,
						row: 0,
						slot: 0,
						tall: 0.4,
						thick: 0.2
					}
				],
				hauntId: 'b0',
				lastHauntId: null,
				phase: 'idle',
				round: 1,
				lowDetail: false,
				audioWanted: false,
				dockCollapsed: false
			})
		});
		const loaded = readShelfSave(storage);
		expect(loaded.items).toHaveLength(48);
		const b0 = loaded.items.find((i) => i.id === 'b0');
		expect(b0?.title).toBe('夜航');
		expect(b0?.row).toBe(1);
		expect(b0?.slot).toBe(2);
		expect(loaded.notice).toMatch(/货架又添了几格/);
		expect(hauntIdsOf(loaded)).toContain('b0');
		expect(new Set(loaded.items.map((i) => i.id)).size).toBe(48);
		expect(storage.getItem('qingxin.games.cargo-haul')).toBe('{"schema":2}');
		const saved = JSON.parse(storage.getItem('qingxin.games.memory-shelf')!);
		expect(saved.schema).toBe(3);
		expect(saved.hauntIds).toContain('b0');
		expect(saved.flash).toBe('expanded');
		const again = readShelfSave(storage);
		expect(again.notice).toMatch(/货架又添了几格/);
		expect(again.items.find((i) => i.id === 'b0')?.slot).toBe(2);
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
		expect(loaded.items).toHaveLength(48);
		expect(visibleItems(loaded).length).toBeLessThanOrEqual(30);
		expect(loaded.notice).toMatch(/货架换了样子/);
		expect(storage.getItem('qingxin.theme')).toBe('light');
		const saved = JSON.parse(storage.getItem('qingxin.games.memory-shelf')!);
		expect(saved.schema).toBe(3);
		expect(saved.flash).toBe('migrated');
		const again = readShelfSave(storage);
		expect(again.notice).toMatch(/货架换了样子/);
		expect(again.lowDetail).toBe(true);
	});

	it('low-detail toggle parks extra ids and restores them', () => {
		const storage = memory();
		const world = createShelf(() => 0.25);
		const ids = world.items.map((i) => i.id).sort();
		world.lowDetail = true;
		applyTable(world, () => 0.2);
		expect(visibleItems(world)).toHaveLength(30);
		expect(world.items).toHaveLength(48);
		writeShelfSave(world, storage);
		const loaded = readShelfSave(storage);
		expect(loaded.items.map((i) => i.id).sort()).toEqual(ids);
		expect(visibleItems(loaded)).toHaveLength(30);
		loaded.lowDetail = false;
		applyTable(loaded, () => 0.2);
		expect(visibleItems(loaded)).toHaveLength(48);
		expect(loaded.items.map((i) => i.id).sort()).toEqual(ids);
	});

	it('recovers a corrupt save without throwing', () => {
		const storage = memory({ 'qingxin.games.memory-shelf': '{nope' });
		const loaded = readShelfSave(storage);
		expect(loaded.recovered).toBe(true);
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

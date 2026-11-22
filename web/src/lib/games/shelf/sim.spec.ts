import { describe, expect, it } from 'vitest';
import {
	applyTable,
	anyApology,
	createShelf,
	hauntIdsOf,
	hauntOf,
	itemAt,
	nextRound,
	pickItem,
	placeHeld,
	shelfLayout,
	shelfPhase,
	stepShelf,
	visibleItems
} from './sim';

function drive(world: ReturnType<typeof createShelf>, ms: number) {
	let left = ms;
	while (left > 0) {
		const dt = Math.min(50, left);
		stepShelf(world, dt);
		left -= dt;
	}
}

describe('haunted bookshelf', () => {
	it('high fill is 48 cells with ~36 books and 12 props', () => {
		const world = createShelf(() => 0.2);
		expect(world.items).toHaveLength(48);
		expect(world.items.filter((i) => i.kind === 'book')).toHaveLength(36);
		expect(world.items.filter((i) => i.kind === 'prop')).toHaveLength(12);
		expect(new Set(world.items.map((i) => i.id)).size).toBe(48);
		expect(new Set(world.items.map((i) => `${i.row}:${i.slot}`)).size).toBe(48);
		expect(hauntIdsOf(world)).toHaveLength(4);
		expect(new Set(hauntIdsOf(world)).size).toBe(4);
		expect(shelfPhase(world)).toBe('idle');
		expect(world.over).toBe(false);
		drive(world, 20_000);
		expect(world.over).toBe(false);
		expect(shelfPhase(world)).toBe('idle');
	});

	it('compact table is 30 visible cells and haunt cap 2 without dropping ids', () => {
		const world = createShelf(() => 0.2);
		const ids = world.items.map((i) => i.id).sort();
		world.lowDetail = true;
		applyTable(world, () => 0.3);
		expect(world.items).toHaveLength(48);
		expect(visibleItems(world)).toHaveLength(30);
		expect(visibleItems(world).filter((i) => i.kind === 'book').length).toBeGreaterThanOrEqual(20);
		expect(hauntIdsOf(world).length).toBeLessThanOrEqual(2);
		world.lowDetail = false;
		applyTable(world, () => 0.3);
		expect(world.items.map((i) => i.id).sort()).toEqual(ids);
		expect(visibleItems(world)).toHaveLength(48);
	});

	it('swaps two items on pick and place without moving the rest', () => {
		const world = createShelf(() => 0.4);
		const busy = new Set(hauntIdsOf(world));
		const a = world.items.find((i) => i.kind === 'book' && !busy.has(i.id))!;
		const b = world.items.find((i) => i.id !== a.id && i.row === a.row)!;
		const before = shelfLayout(world);
		const aRow = a.row;
		const aSlot = a.slot;
		const bRow = b.row;
		const bSlot = b.slot;
		pickItem(world, a.id);
		expect(world.heldId).toBe(a.id);
		expect(shelfPhase(world)).toBe('idle');
		placeHeld(world, bRow, bSlot);
		expect(world.heldId).toBeNull();
		expect(itemAt(world, bRow, bSlot)?.id).toBe(a.id);
		expect(itemAt(world, aRow, aSlot)?.id).toBe(b.id);
		expect(shelfLayout(world).filter((line, i) => line !== before[i])).toHaveLength(2);
	});

	it('two books cry at once with separate haunt state', () => {
		const world = createShelf(() => 0.1);
		const [a, b] = hauntIdsOf(world);
		expect(a).toBeTruthy();
		expect(b).toBeTruthy();
		pickItem(world, a!);
		pickItem(world, b!);
		expect(hauntOf(world, a!)?.phase).toBe('emerge');
		expect(hauntOf(world, b!)?.phase).toBe('emerge');
		drive(world, 2000);
		expect(['face', 'cry', 'sorry']).toContain(hauntOf(world, a!)?.phase);
		expect(['face', 'cry', 'sorry']).toContain(hauntOf(world, b!)?.phase);
		expect(hauntOf(world, a!)?.bookId).toBe(a);
		expect(hauntOf(world, b!)?.bookId).toBe(b);
	});

	it('four concurrent haunts keep separate books and phases', () => {
		const world = createShelf(() => 0.12);
		const ids = hauntIdsOf(world);
		expect(ids).toHaveLength(4);
		expect(new Set(ids).size).toBe(4);
		for (const id of ids) pickItem(world, id);
		expect(ids.every((id) => hauntOf(world, id)?.phase === 'emerge')).toBe(true);
		drive(world, 2100);
		for (const id of ids) {
			const haunt = hauntOf(world, id);
			expect(haunt?.bookId).toBe(id);
			expect(['face', 'cry', 'sorry']).toContain(haunt?.phase);
		}
		expect(world.haunts).toHaveLength(4);
		expect(new Set(world.items.map((i) => i.id)).size).toBe(48);
	});

	it('apology is 对不起 and the ghost returns to the same book then auto-refills', () => {
		const world = createShelf(() => 0.15);
		const book = hauntIdsOf(world)[0]!;
		pickItem(world, book);
		expect(world.heldId).toBeNull();
		let saw = false;
		for (let i = 0; i < 220; i++) {
			stepShelf(world, 40);
			if (hauntOf(world, book)?.phase === 'sorry' && anyApology(world)) {
				saw = true;
				expect(world.notice).toMatch(/对不起/);
			}
		}
		expect(saw).toBe(true);
		expect(hauntIdsOf(world)).not.toContain(book);
		expect(world.coolIds).toContain(book);
		expect(hauntIdsOf(world)).toHaveLength(4);
		expect(hauntIdsOf(world).includes(book)).toBe(false);
		pickItem(world, book);
		expect(hauntOf(world, book)).toBeUndefined();
		expect(world.items.filter((i) => i.id === book)).toHaveLength(1);
	});

	it('shows 对不起 during sorry even with reduced motion', () => {
		const world = createShelf(() => 0.3);
		world.reducedMotion = true;
		applyTable(world, () => 0.3);
		const book = hauntIdsOf(world)[0]!;
		pickItem(world, book);
		let sawSorry = false;
		for (let i = 0; i < 80; i++) {
			stepShelf(world, 40);
			if (hauntOf(world, book)?.phase === 'sorry' && anyApology(world)) sawSorry = true;
		}
		expect(sawSorry).toBe(true);
		expect(hauntIdsOf(world)).not.toContain(book);
	});

	it('pauses the haunt sequence', () => {
		const world = createShelf(() => 0.15);
		const book = hauntIdsOf(world)[0]!;
		pickItem(world, book);
		expect(hauntOf(world, book)?.phase).toBe('emerge');
		world.paused = true;
		drive(world, 4000);
		expect(hauntOf(world, book)?.phase).toBe('emerge');
		world.paused = false;
		drive(world, 8000);
		expect(hauntIdsOf(world)).not.toContain(book);
	});

	it('rearranges a non-haunt while another ghost plays; no dupe or loss', () => {
		const world = createShelf(() => 0.4);
		pickItem(world, hauntIdsOf(world)[0]!);
		const busy = new Set(hauntIdsOf(world));
		const a = world.items.find((i) => i.kind === 'book' && !busy.has(i.id))!;
		const b = world.items.find((i) => i.id !== a.id && i.row === a.row)!;
		const ids = world.items.map((i) => i.id).sort();
		const bRow = b.row;
		const bSlot = b.slot;
		pickItem(world, a.id);
		placeHeld(world, bRow, bSlot);
		expect(itemAt(world, bRow, bSlot)?.id).toBe(a.id);
		expect(world.items.map((i) => i.id).sort()).toEqual(ids);
		expect(new Set(world.items.map((i) => `${i.row}:${i.slot}`)).size).toBe(48);
	});

	it('starts a new round with different haunts and the same arrangement', () => {
		const world = createShelf(() => 0.6);
		pickItem(world, hauntIdsOf(world)[0]!);
		drive(world, 8000);
		const layout = shelfLayout(world);
		const prev = [...hauntIdsOf(world)].sort().join(',');
		nextRound(world, () => 0.05);
		expect(shelfPhase(world)).toBe('idle');
		expect([...hauntIdsOf(world)].sort().join(',')).not.toBe(prev);
		expect(world.round).toBe(1);
		expect(shelfLayout(world)).toEqual(layout);
	});
});

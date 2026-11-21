import { describe, expect, it } from 'vitest';
import { createShelf, itemAt, nextRound, pickItem, placeHeld, shelfLayout, stepShelf } from './sim';

function drive(world: ReturnType<typeof createShelf>, ms: number) {
	let left = ms;
	while (left > 0) {
		const dt = Math.min(50, left);
		stepShelf(world, dt);
		left -= dt;
	}
}

describe('haunted bookshelf', () => {
	it('starts with a packed bookcase, exactly one haunted book, and no timer fail', () => {
		const world = createShelf(() => 0.2);
		expect(world.items.length).toBeGreaterThanOrEqual(20);
		expect(world.items.filter((i) => i.kind === 'book').length).toBeGreaterThanOrEqual(16);
		expect(world.items.filter((i) => i.kind === 'prop').length).toBeGreaterThanOrEqual(4);
		expect(world.phase).toBe('idle');
		expect(world.over).toBe(false);
		const haunted = world.items.filter((i) => i.id === world.hauntId);
		expect(haunted).toHaveLength(1);
		expect(haunted[0]?.kind).toBe('book');
		drive(world, 20_000);
		expect(world.over).toBe(false);
		expect(world.phase).toBe('idle');
	});

	it('swaps two items on pick and place without moving the rest', () => {
		const world = createShelf(() => 0.4);
		const haunt = world.hauntId;
		const a = world.items.find((i) => i.kind === 'book' && i.id !== haunt)!;
		const b = world.items.find((i) => i.id !== a.id && i.id !== haunt && i.row === a.row)!;
		const before = shelfLayout(world);
		const aRow = a.row;
		const aSlot = a.slot;
		const bRow = b.row;
		const bSlot = b.slot;
		pickItem(world, a.id);
		expect(world.heldId).toBe(a.id);
		expect(world.phase).toBe('idle');
		placeHeld(world, bRow, bSlot);
		expect(world.heldId).toBeNull();
		expect(itemAt(world, bRow, bSlot)?.id).toBe(a.id);
		expect(itemAt(world, aRow, aSlot)?.id).toBe(b.id);
		expect(shelfLayout(world).filter((line, i) => line !== before[i])).toHaveLength(2);
	});

	it('plays emerge cry apology return once, then will not retrigger', () => {
		const world = createShelf(() => 0.1);
		pickItem(world, world.hauntId);
		expect(world.phase).toBe('emerge');
		expect(world.heldId).toBe(world.hauntId);
		drive(world, 1200);
		expect(['face', 'cry', 'sorry']).toContain(world.phase);
		drive(world, 8000);
		expect(world.phase).toBe('done');
		expect(world.apology).toBe(false);
		const haunt = world.hauntId;
		placeHeld(
			world,
			world.items.find((i) => i.id === haunt)!.row,
			world.items.find((i) => i.id === haunt)!.slot
		);
		pickItem(world, haunt);
		expect(world.phase).toBe('done');
		expect(world.items.filter((i) => i.kind === 'book' && i.id === haunt)).toHaveLength(1);
	});

	it('shows 对不起 during sorry even with reduced motion', () => {
		const world = createShelf(() => 0.3);
		world.reducedMotion = true;
		pickItem(world, world.hauntId);
		let sawSorry = false;
		for (let i = 0; i < 80; i++) {
			stepShelf(world, 40);
			if (world.phase === 'sorry' && world.apology) sawSorry = true;
		}
		expect(sawSorry).toBe(true);
		expect(world.phase).toBe('done');
	});

	it('pauses the haunt sequence', () => {
		const world = createShelf(() => 0.15);
		pickItem(world, world.hauntId);
		expect(world.phase).toBe('emerge');
		world.paused = true;
		drive(world, 4000);
		expect(world.phase).toBe('emerge');
		world.paused = false;
		drive(world, 8000);
		expect(world.phase).toBe('done');
	});

	it('starts a new round with a different haunt and the same arrangement', () => {
		const world = createShelf(() => 0.6);
		pickItem(world, world.hauntId);
		drive(world, 8000);
		const layout = shelfLayout(world);
		const prev = world.hauntId;
		nextRound(world, () => 0.05);
		expect(world.phase).toBe('idle');
		expect(world.hauntId).not.toBe(prev);
		expect(world.round).toBe(1);
		expect(shelfLayout(world)).toEqual(layout);
	});
});

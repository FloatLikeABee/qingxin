import { describe, expect, it } from 'vitest';
import {
	closeInspect,
	createStudy,
	enterRoom,
	hintShelf,
	inspectProp,
	isShelfRestored,
	nextShelf,
	placeInRoom,
	putInSlot,
	rememberShelf,
	stepStudy,
	takeProp
} from './sim';

function restoreAll(world: ReturnType<typeof createStudy>) {
	for (let i = 0; i < world.goal.length; i++) {
		const want = world.goal[i]!;
		if (world.slots[i] === want) continue;
		const at = world.slots.indexOf(want);
		if (at >= 0) takeProp(world, want);
		putInSlot(world, i);
	}
}

describe('memory shelf study', () => {
	it('starts in observe with a three-object shelf and no timer fail', () => {
		const world = createStudy();
		expect(world.phase).toBe('observe');
		expect(world.puzzle).toBe(0);
		expect(world.slots).toHaveLength(3);
		expect(world.goal).toEqual(world.slots);
		expect(world.over).toBe(false);
		stepStudy(world, 20_000);
		expect(world.over).toBe(false);
		expect(world.phase).toBe('observe');
	});

	it('scrambles after you remember, without matching the goal', () => {
		const world = createStudy();
		rememberShelf(world, () => 0.99);
		stepStudy(world, 800);
		expect(world.phase).toBe('restore');
		expect(world.slots.join(',')).not.toBe(world.goal.join(','));
		const moved = world.slots.filter((k, i) => k !== world.goal[i]).length;
		expect(moved).toBeGreaterThanOrEqual(2);
	});

	it('lets a wrong placement be corrected instead of failing', () => {
		const world = createStudy();
		rememberShelf(world, () => 0.8);
		stepStudy(world, 800);
		const home = world.goal.indexOf('globe');
		const wrong = world.goal.findIndex((_, i) => i !== home);
		takeProp(world, 'globe');
		putInSlot(world, wrong);
		expect(world.lastWrong).toBe(true);
		expect(isShelfRestored(world)).toBe(false);
		expect(world.over).toBe(false);
		restoreAll(world);
		expect(isShelfRestored(world)).toBe(true);
		expect(world.phase).toBe('cleared');
		expect(world.unlocked).toContain('globe');
	});

	it('unlocks the collection and opens a harder shelf next', () => {
		const world = createStudy();
		rememberShelf(world);
		stepStudy(world, 800);
		restoreAll(world);
		expect(world.unlocked.length).toBeGreaterThanOrEqual(1);
		nextShelf(world);
		expect(world.puzzle).toBe(1);
		expect(world.phase).toBe('observe');
		expect(world.slots.length).toBeGreaterThan(3);
	});

	it('inspects an object in 3D without moving it', () => {
		const world = createStudy();
		inspectProp(world, 'cup');
		expect(world.inspecting).toBe('cup');
		expect(world.slots.includes('cup')).toBe(true);
		closeInspect(world);
		expect(world.inspecting).toBeNull();
	});

	it('pauses during the veil so the scramble waits', () => {
		const world = createStudy();
		rememberShelf(world);
		expect(world.phase).toBe('veil');
		world.paused = true;
		stepStudy(world, 2000);
		expect(world.phase).toBe('veil');
		world.paused = false;
		stepStudy(world, 800);
		expect(world.phase).toBe('restore');
	});

	it('places an unlocked object in the collection room', () => {
		const world = createStudy();
		rememberShelf(world);
		stepStudy(world, 800);
		restoreAll(world);
		enterRoom(world);
		expect(world.room).toBe('collection');
		placeInRoom(world, 'globe', 1.2, -0.4, 0.3);
		const put = world.placements.find((p) => p.kind === 'globe');
		expect(put?.arranged).toBe(true);
		expect(put?.x).toBeCloseTo(1.2);
	});

	it('offers a hint without solving the shelf', () => {
		const world = createStudy();
		rememberShelf(world);
		stepStudy(world, 800);
		hintShelf(world);
		expect(world.hintSlot).not.toBeNull();
		expect(isShelfRestored(world)).toBe(false);
	});
});

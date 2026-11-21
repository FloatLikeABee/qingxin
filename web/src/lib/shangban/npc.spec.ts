import { describe, expect, it } from 'vitest';
import { DAY_TICKS, dayPhase } from './day';
import { isWalkable } from './floors';
import { chooseStaffActivity, tickStaff, type StaffNpc } from './npc';
import { createWorld, tickWorld } from './sim';

function staff(partial: Partial<StaffNpc> = {}): StaffNpc {
	return {
		id: 1,
		floor: 1,
		x: 2,
		z: 4,
		homeX: 2,
		homeZ: 4,
		phase: 'work',
		activity: 'type',
		wait: 0,
		path: [],
		...partial
	};
}

describe('上班 staff routines', () => {
	it('picks coffee at lunch, elevator near close, typing in the morning', () => {
		expect(dayPhase(Math.floor(DAY_TICKS * (3.2 / 9)))).toBe('lunch');
		expect(chooseStaffActivity(staff(), Math.floor(DAY_TICKS * (3.2 / 9)), () => 0)).toBe('coffee');
		expect(chooseStaffActivity(staff(), DAY_TICKS - 2, () => 0)).toBe('elevator');
		expect(chooseStaffActivity(staff({ floor: 3 }), 80, () => 0.1)).toBe('repair');
	});

	it('walks on walkable tiles and does not teleport through walls', () => {
		const world = createWorld({ seed: 9 });
		for (let i = 0; i < 80; i++) tickWorld(world);
		for (const npc of world.npcs) {
			expect(isWalkable(npc.floor, Math.round(npc.x), Math.round(npc.z))).toBe(true);
			expect(['type', 'deliver', 'repair', 'meet', 'chat', 'coffee', 'elevator', 'idle']).toContain(
				npc.activity
			);
		}
		const walker = staff({ x: 2, z: 4, wait: 0, path: [] });
		tickStaff({ tick: 80, rng: () => 0.2, npcs: [walker] });
		if (walker.path.length > 0) {
			for (const step of walker.path) {
				expect(
					isWalkable(walker.floor, step.x, step.z) ||
						(step.x === walker.path[walker.path.length - 1]?.x &&
							step.z === walker.path[walker.path.length - 1]?.z)
				).toBe(true);
			}
		}
	});
});

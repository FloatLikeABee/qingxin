import { describe, expect, it } from 'vitest';
import { ENTRANCE, isWalkable, pathfind, SHELF_SPOTS, standForShelf } from './layout';

describe('store layout', () => {
	it('finds a walkable path from the door to a shelf stand', () => {
		const stand = standForShelf(SHELF_SPOTS[0]!);
		expect(isWalkable(stand.x, stand.z)).toBe(true);
		const path = pathfind(ENTRANCE, stand);
		expect(path.length).toBeGreaterThan(0);
		expect(path.at(-1)).toEqual(stand);
	});
});

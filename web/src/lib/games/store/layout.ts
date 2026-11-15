import type { SkuId } from './goods';

export const COLS = 11;
export const ROWS = 9;
export const TILE = 1.15;

export function worldX(x: number): number {
	return (x - (COLS - 1) / 2) * TILE;
}

export function worldZ(z: number): number {
	return (z - (ROWS - 1) / 2) * TILE;
}

export interface Cell {
	x: number;
	z: number;
}

export const ENTRANCE: Cell = { x: 5, z: 8 };
export const CHECKOUT: Cell = { x: 9, z: 6 };
export const QUEUE: Cell = { x: 8, z: 6 };

export const SHELF_SPOTS: { id: number; sku: SkuId; x: number; z: number }[] = [
	{ id: 0, sku: 'water', x: 2, z: 2 },
	{ id: 1, sku: 'bread', x: 4, z: 2 },
	{ id: 2, sku: 'milk', x: 6, z: 2 },
	{ id: 3, sku: 'snacks', x: 2, z: 4 },
	{ id: 4, sku: 'bento', x: 4, z: 4 }
];

const blocked = new Set<string>();

function key(x: number, z: number): string {
	return `${x},${z}`;
}

for (let x = 0; x < COLS; x++) {
	blocked.add(key(x, 0));
	if (!(x === ENTRANCE.x)) blocked.add(key(x, ROWS - 1));
}
for (let z = 0; z < ROWS; z++) {
	blocked.add(key(0, z));
	blocked.add(key(COLS - 1, z));
}
for (const shelf of SHELF_SPOTS) blocked.add(key(shelf.x, shelf.z));
blocked.add(key(CHECKOUT.x, CHECKOUT.z));

export function inBounds(x: number, z: number): boolean {
	return x >= 0 && z >= 0 && x < COLS && z < ROWS;
}

export function isWalkable(x: number, z: number): boolean {
	return inBounds(x, z) && !blocked.has(key(x, z));
}

export function standForShelf(spot: { x: number; z: number }): Cell {
	const candidates: Cell[] = [
		{ x: spot.x, z: spot.z + 1 },
		{ x: spot.x + 1, z: spot.z },
		{ x: spot.x - 1, z: spot.z },
		{ x: spot.x, z: spot.z - 1 }
	];
	return candidates.find((cell) => isWalkable(cell.x, cell.z)) ?? { x: spot.x, z: spot.z + 1 };
}

export function pathfind(from: Cell, to: Cell): Cell[] {
	if (from.x === to.x && from.z === to.z) return [];
	const start = key(from.x, from.z);
	const goal = key(to.x, to.z);
	const seen = new Set<string>([start]);
	const queue: { cell: Cell; path: Cell[] }[] = [{ cell: from, path: [] }];
	const deltas = [
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1]
	];
	while (queue.length > 0) {
		const current = queue.shift();
		if (!current) break;
		for (const [dx, dz] of deltas) {
			const next = { x: current.cell.x + dx, z: current.cell.z + dz };
			const token = key(next.x, next.z);
			if (seen.has(token)) continue;
			const walk = isWalkable(next.x, next.z) || token === goal;
			if (!walk) continue;
			seen.add(token);
			const path = [...current.path, next];
			if (token === goal) return path;
			queue.push({ cell: next, path });
		}
	}
	return [];
}

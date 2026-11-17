export const CELL = 0.36;
export const GRID_X = 16;
export const GRID_Z = 16;
export const GRID_Y = 12;
export const TRAY_SIZE = 5;
export const MAX_PLACED = 80;
export const MAX_UNDO = 80;

export type ShapeId = 'cube' | 'bar' | 'pillar' | 'ell' | 'plate' | 'stair';
export type ColorId = 'blue' | 'sky' | 'coral' | 'teal' | 'gold';
export type Rot = 0 | 1 | 2 | 3;

export interface Cell {
	x: number;
	y: number;
	z: number;
}

export interface PieceDef {
	id: ShapeId;
	name: string;
	cells: Cell[];
}

export const COLORS: ColorId[] = ['blue', 'sky', 'coral', 'teal', 'gold'];

export const SHAPES: Record<ShapeId, PieceDef> = {
	cube: { id: 'cube', name: '方块', cells: [{ x: 0, y: 0, z: 0 }] },
	bar: {
		id: 'bar',
		name: '长条',
		cells: [
			{ x: 0, y: 0, z: 0 },
			{ x: 1, y: 0, z: 0 }
		]
	},
	pillar: {
		id: 'pillar',
		name: '立柱',
		cells: [
			{ x: 0, y: 0, z: 0 },
			{ x: 0, y: 1, z: 0 }
		]
	},
	ell: {
		id: 'ell',
		name: '弯角',
		cells: [
			{ x: 0, y: 0, z: 0 },
			{ x: 1, y: 0, z: 0 },
			{ x: 0, y: 0, z: 1 }
		]
	},
	plate: {
		id: 'plate',
		name: '平板',
		cells: [
			{ x: 0, y: 0, z: 0 },
			{ x: 1, y: 0, z: 0 },
			{ x: 0, y: 0, z: 1 },
			{ x: 1, y: 0, z: 1 }
		]
	},
	stair: {
		id: 'stair',
		name: '台阶',
		cells: [
			{ x: 0, y: 0, z: 0 },
			{ x: 0, y: 1, z: 0 },
			{ x: 1, y: 1, z: 0 }
		]
	}
};

const DECKS: ShapeId[][] = [
	['cube', 'bar', 'ell', 'plate', 'stair'],
	['cube', 'pillar', 'bar', 'ell', 'plate'],
	['cube', 'stair', 'plate', 'pillar', 'ell'],
	['cube', 'ell', 'bar', 'stair', 'plate']
];

export function shapeById(id: string): PieceDef | undefined {
	return Object.hasOwn(SHAPES, id) ? SHAPES[id as ShapeId] : undefined;
}

export function cellKey(cell: Cell) {
	return `${cell.x},${cell.y},${cell.z}`;
}

export function inBounds(cell: Cell) {
	return (
		Number.isInteger(cell.x) &&
		Number.isInteger(cell.y) &&
		Number.isInteger(cell.z) &&
		cell.x >= 0 &&
		cell.x < GRID_X &&
		cell.y >= 0 &&
		cell.y < GRID_Y &&
		cell.z >= 0 &&
		cell.z < GRID_Z
	);
}

function rotateCell(cell: Cell, rotY: Rot, rotX: Rot): Cell {
	let { x, y, z } = cell;
	for (let i = 0; i < rotY; i++) {
		const nx = z;
		z = -x;
		x = nx;
	}
	for (let i = 0; i < rotX; i++) {
		const ny = -z;
		z = y;
		y = ny;
	}
	return { x, y, z };
}

export interface Oriented {
	shape: ShapeId;
	origin: Cell;
	rotY: Rot;
	rotX: Rot;
}

export function worldCells(piece: Oriented): Cell[] {
	const def = SHAPES[piece.shape];
	const rotated = def.cells.map((cell) => rotateCell(cell, piece.rotY, piece.rotX));
	const minX = Math.min(...rotated.map((cell) => cell.x));
	const minY = Math.min(...rotated.map((cell) => cell.y));
	const minZ = Math.min(...rotated.map((cell) => cell.z));
	return rotated.map((cell) => ({
		x: cell.x - minX + piece.origin.x,
		y: cell.y - minY + piece.origin.y,
		z: cell.z - minZ + piece.origin.z
	}));
}

export function makeBatch(batchIndex: number, nextId: { n: number }) {
	const deck = DECKS[((batchIndex % DECKS.length) + DECKS.length) % DECKS.length];
	return deck.map((shape, index) => ({
		id: `p${nextId.n++}`,
		shape,
		color: COLORS[index] ?? 'blue',
		rotY: 0 as Rot,
		rotX: 0 as Rot
	}));
}

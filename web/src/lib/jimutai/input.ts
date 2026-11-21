import { CELL, GRID_X, GRID_Z, type Cell } from './pieces';

export const TAP_PX = 10;

export type Gesture = 'tap' | 'orbit' | 'pan' | 'pinch';
export type Face = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';

export function classifyGesture(input: {
	dx: number;
	dy: number;
	pointers: number;
	shift: boolean;
	button: number;
}): Gesture {
	if (input.pointers >= 2) return 'pinch';
	if (input.shift || input.button === 1 || input.button === 2) return 'pan';
	if (Math.hypot(input.dx, input.dy) >= TAP_PX) return 'orbit';
	return 'tap';
}

export function worldToCell(x: number, y: number, z: number): Cell {
	return {
		x: Math.round(x / CELL + (GRID_X - 1) / 2),
		y: Math.max(0, Math.round((y - CELL / 2) / CELL)),
		z: Math.round(z / CELL + (GRID_Z - 1) / 2)
	};
}

export function cellCenter(cell: Cell) {
	return {
		x: (cell.x - (GRID_X - 1) / 2) * CELL,
		y: cell.y * CELL + CELL / 2,
		z: (cell.z - (GRID_Z - 1) / 2) * CELL
	};
}

export function originFromGround(x: number, z: number): Cell {
	const cell = worldToCell(x, CELL / 2, z);
	return { x: cell.x, y: 0, z: cell.z };
}

const FACE_DELTA: Record<Face, Cell> = {
	px: { x: 1, y: 0, z: 0 },
	nx: { x: -1, y: 0, z: 0 },
	py: { x: 0, y: 1, z: 0 },
	ny: { x: 0, y: -1, z: 0 },
	pz: { x: 0, y: 0, z: 1 },
	nz: { x: 0, y: 0, z: -1 }
};

export function originFromPieceFace(cell: Cell, face: Face): Cell {
	const delta = FACE_DELTA[face];
	return { x: cell.x + delta.x, y: cell.y + delta.y, z: cell.z + delta.z };
}

export function faceFromNormal(nx: number, ny: number, nz: number): Face {
	const ax = Math.abs(nx);
	const ay = Math.abs(ny);
	const az = Math.abs(nz);
	if (ay >= ax && ay >= az) return ny >= 0 ? 'py' : 'ny';
	if (ax >= az) return nx >= 0 ? 'px' : 'nx';
	return nz >= 0 ? 'pz' : 'nz';
}

export function zoomDistance(distance: number, delta: number) {
	const next = distance * (delta > 0 ? 1.08 : 0.92);
	return Math.min(18, Math.max(5, next));
}

import {
	MAX_PLACED,
	MAX_UNDO,
	SHAPES,
	cellKey,
	inBounds,
	makeBatch,
	worldCells,
	type Cell,
	type ColorId,
	type Rot,
	type ShapeId
} from './pieces';

export interface TrayPiece {
	id: string;
	shape: ShapeId;
	color: ColorId;
	rotY: Rot;
	rotX: Rot;
}

export interface PlacedPiece extends TrayPiece {
	origin: Cell;
}

export interface UndoEntry {
	placed: PlacedPiece;
	refill: TrayPiece[] | null;
}

export interface CameraState {
	yaw: number;
	pitch: number;
	distance: number;
	targetX: number;
	targetY: number;
	targetZ: number;
}

export interface World {
	schema: 1;
	nextId: number;
	notice: string;
	recovered: boolean;
	placed: PlacedPiece[];
	tray: TrayPiece[];
	selected: number;
	batchIndex: number;
	undo: UndoEntry[];
	camera: CameraState;
}

export interface PlaceCheck {
	ok: boolean;
	reason: string;
	cells: Cell[];
}

function neighbors(cell: Cell): Cell[] {
	return [
		{ x: cell.x + 1, y: cell.y, z: cell.z },
		{ x: cell.x - 1, y: cell.y, z: cell.z },
		{ x: cell.x, y: cell.y + 1, z: cell.z },
		{ x: cell.x, y: cell.y - 1, z: cell.z },
		{ x: cell.x, y: cell.y, z: cell.z + 1 },
		{ x: cell.x, y: cell.y, z: cell.z - 1 }
	];
}

export function defaultCamera(): CameraState {
	return {
		yaw: 0.72,
		pitch: 0.78,
		distance: 9.5,
		targetX: 0,
		targetY: 0.35,
		targetZ: 0
	};
}

export function createWorld(): World {
	const next = { n: 1 };
	return {
		schema: 1,
		notice: '托盘里有五块小积木。点桌面放上去，没有输赢。',
		recovered: false,
		placed: [],
		tray: makeBatch(0, next),
		selected: 0,
		batchIndex: 0,
		undo: [],
		camera: defaultCamera(),
		nextId: next.n
	};
}

export function occupancy(world: World) {
	const set = new Set<string>();
	for (const piece of world.placed) {
		for (const cell of worldCells(piece)) set.add(cellKey(cell));
	}
	return set;
}

export function selectedPiece(world: World): TrayPiece | null {
	return world.tray[world.selected] ?? world.tray[0] ?? null;
}

export function previewCells(world: World, origin: Cell): Cell[] {
	const piece = selectedPiece(world);
	if (!piece) return [];
	return worldCells({ ...piece, origin });
}

export function canPlace(world: World, origin: Cell): PlaceCheck {
	const piece = selectedPiece(world);
	if (!piece) return { ok: false, reason: 'empty', cells: [] };
	if (world.placed.length >= MAX_PLACED) {
		return { ok: false, reason: 'full', cells: [] };
	}
	const cells = worldCells({ ...piece, origin });
	const occ = occupancy(world);
	let grounded = false;
	let attached = false;
	for (const cell of cells) {
		if (!inBounds(cell)) return { ok: false, reason: 'out', cells };
		if (occ.has(cellKey(cell))) return { ok: false, reason: 'overlap', cells };
		if (cell.y === 0) grounded = true;
		for (const next of neighbors(cell)) {
			if (occ.has(cellKey(next))) attached = true;
		}
	}
	if (!grounded && !attached) return { ok: false, reason: 'float', cells };
	return { ok: true, reason: '', cells };
}

export function selectTray(world: World, index: number) {
	if (!world.tray.length) {
		world.selected = 0;
		return;
	}
	world.selected = Math.max(0, Math.min(world.tray.length - 1, Math.round(index)));
}

export function rotateSelected(world: World, axis: 'y' | 'x') {
	const piece = selectedPiece(world);
	if (!piece) return;
	if (axis === 'y') piece.rotY = ((piece.rotY + 1) % 4) as Rot;
	else piece.rotX = ((piece.rotX + 1) % 4) as Rot;
}

export function placeAt(world: World, origin: Cell): boolean {
	const piece = selectedPiece(world);
	if (!piece) {
		world.notice =
			world.placed.length >= MAX_PLACED
				? '桌子满了。80 块是上限，可以撤销或清空再搭。'
				: '托盘是空的。';
		return false;
	}
	const check = canPlace(world, origin);
	if (!check.ok) {
		world.notice =
			check.reason === 'overlap'
				? '这块位置已经有积木了。'
				: check.reason === 'float'
					? '要贴着地面或已经放好的积木。'
					: check.reason === 'full'
						? '桌子满了。80 块是上限，可以撤销或清空再搭。'
						: '这块放不下去。';
		return false;
	}
	const index = world.tray.indexOf(piece);
	world.tray.splice(index >= 0 ? index : 0, 1);
	const placed: PlacedPiece = { ...piece, origin: { ...origin } };
	world.placed.push(placed);
	const entry: UndoEntry = { placed, refill: null };
	world.undo.push(entry);
	if (world.undo.length > MAX_UNDO) world.undo.shift();
	if (world.tray.length === 0) {
		if (world.placed.length >= MAX_PLACED) {
			world.notice = '桌子满了。80 块是上限，可以撤销或清空再搭。';
			world.selected = 0;
		} else {
			const next = { n: world.nextId };
			const refill = makeBatch(world.batchIndex + 1, next);
			world.nextId = next.n;
			world.tray = refill;
			world.selected = 0;
			world.batchIndex += 1;
			entry.refill = refill;
			world.notice = '五块都放完了，又来了五块。';
		}
	} else {
		selectTray(world, Math.min(index, world.tray.length - 1));
		world.notice = `放好了。托盘还剩 ${world.tray.length} 块。`;
	}
	return true;
}

export function undoLast(world: World): boolean {
	const entry = world.undo.pop();
	if (!entry) {
		world.notice = '没有可以撤回的步骤。';
		return false;
	}
	if (entry.refill) {
		const ids = new Set(entry.refill.map((piece) => piece.id));
		world.tray = world.tray.filter((piece) => !ids.has(piece.id));
		world.batchIndex = Math.max(0, world.batchIndex - 1);
	}
	world.placed = world.placed.filter((piece) => piece.id !== entry.placed.id);
	const restored: TrayPiece = {
		id: entry.placed.id,
		shape: entry.placed.shape,
		color: entry.placed.color,
		rotY: entry.placed.rotY,
		rotX: entry.placed.rotX
	};
	world.tray.push(restored);
	world.selected = world.tray.length - 1;
	world.notice = `收回了${SHAPES[restored.shape].name}。`;
	return true;
}

export function resetWorld(world: World) {
	const fresh = createWorld();
	world.schema = 1;
	world.nextId = fresh.nextId;
	world.notice = '桌子清空了。又是五块小积木。';
	world.recovered = false;
	world.placed = fresh.placed;
	world.tray = fresh.tray;
	world.selected = 0;
	world.batchIndex = 0;
	world.undo = [];
	world.camera = fresh.camera;
}

export function copyWorld(world: World): World {
	return {
		schema: 1,
		nextId: world.nextId,
		notice: world.notice,
		recovered: world.recovered,
		placed: world.placed.map((piece) => ({ ...piece, origin: { ...piece.origin } })),
		tray: world.tray.map((piece) => ({ ...piece })),
		selected: world.selected,
		batchIndex: world.batchIndex,
		undo: world.undo.map((entry) => ({
			placed: { ...entry.placed, origin: { ...entry.placed.origin } },
			refill: entry.refill ? entry.refill.map((piece) => ({ ...piece })) : null
		})),
		camera: { ...world.camera }
	};
}

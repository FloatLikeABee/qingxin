import {
	COLORS,
	GRID_X,
	GRID_Y,
	GRID_Z,
	MAX_PLACED,
	MAX_UNDO,
	cellKey,
	inBounds,
	makeBatch,
	shapeById,
	worldCells,
	type ColorId,
	type Rot,
	type ShapeId
} from './pieces';
import {
	copyWorld,
	createWorld,
	defaultCamera,
	type CameraState,
	type PlacedPiece,
	type TrayPiece,
	type UndoEntry,
	type World
} from './world';

export const JIMUTAI_SAVE_KEY = 'qingxin.jimutai';
export const JIMUTAI_SCHEMA = 1;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function clamp(n: unknown, min: number, max: number, fallback: number) {
	const value = Number(n);
	if (!Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, value));
}

function asRot(value: unknown): Rot {
	return Math.round(clamp(value, 0, 3, 0)) as Rot;
}

function asShape(value: unknown): ShapeId | null {
	return shapeById(String(value)) ? (value as ShapeId) : null;
}

function asColor(value: unknown): ColorId {
	return COLORS.includes(value as ColorId) ? (value as ColorId) : 'blue';
}

function parseCell(value: unknown) {
	const rec = asRecord(value);
	if (!rec) return null;
	return {
		x: Math.round(clamp(rec.x, 0, GRID_X - 1, 0)),
		y: Math.round(clamp(rec.y, 0, GRID_Y - 1, 0)),
		z: Math.round(clamp(rec.z, 0, GRID_Z - 1, 0))
	};
}

function parseTray(value: unknown): TrayPiece | null {
	const rec = asRecord(value);
	if (!rec) return null;
	const shape = asShape(rec.shape);
	const id = String(rec.id ?? '');
	if (!shape || !id) return null;
	return {
		id,
		shape,
		color: asColor(rec.color),
		rotY: asRot(rec.rotY),
		rotX: asRot(rec.rotX)
	};
}

function parsePlaced(value: unknown): PlacedPiece | null {
	const tray = parseTray(value);
	const rec = asRecord(value);
	if (!tray || !rec) return null;
	const origin = parseCell(rec.origin);
	if (!origin) return null;
	return { ...tray, origin };
}

function parseUndo(value: unknown): UndoEntry | null {
	const rec = asRecord(value);
	if (!rec) return null;
	const placed = parsePlaced(rec.placed);
	if (!placed) return null;
	let refill: TrayPiece[] | null = null;
	if (Array.isArray(rec.refill)) {
		refill = rec.refill.map(parseTray).filter((piece): piece is TrayPiece => Boolean(piece));
		if (refill.length !== 5) refill = null;
	}
	return { placed, refill };
}

function parseCamera(value: unknown): CameraState {
	const rec = asRecord(value);
	const fallback = defaultCamera();
	if (!rec) return fallback;
	return {
		yaw: clamp(rec.yaw, -Math.PI * 4, Math.PI * 4, fallback.yaw),
		pitch: clamp(rec.pitch, 0.18, 1.32, fallback.pitch),
		distance: clamp(rec.distance, 5, 18, fallback.distance),
		targetX: clamp(rec.targetX, -4, 4, fallback.targetX),
		targetY: clamp(rec.targetY, 0, 3, fallback.targetY),
		targetZ: clamp(rec.targetZ, -4, 4, fallback.targetZ)
	};
}

function recoveredWorld(notice = '存档读不出来，桌子重新摆好了。'): World {
	const world = createWorld();
	world.recovered = true;
	world.notice = notice;
	return world;
}

function uniqueIds(pieces: Array<{ id: string }>) {
	const seen = new Set<string>();
	for (const piece of pieces) {
		if (seen.has(piece.id)) return false;
		seen.add(piece.id);
	}
	return true;
}

export function serializeWorld(world: World) {
	return {
		schema: JIMUTAI_SCHEMA,
		nextId: world.nextId,
		notice: world.notice,
		placed: world.placed,
		tray: world.tray,
		selected: world.selected,
		batchIndex: world.batchIndex,
		undo: world.undo,
		camera: world.camera
	};
}

export function writeJimutaiSave(world: World, storage: Store = localStorage) {
	storage.setItem(JIMUTAI_SAVE_KEY, JSON.stringify(serializeWorld(world)));
}

export function readJimutaiSave(storage: Store = localStorage): World {
	const raw = storage.getItem(JIMUTAI_SAVE_KEY);
	if (!raw) return createWorld();
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return recoveredWorld();
	}
	const rec = asRecord(parsed);
	if (!rec || rec.schema !== JIMUTAI_SCHEMA) return recoveredWorld();
	if (!Array.isArray(rec.placed) || !Array.isArray(rec.tray)) return recoveredWorld();
	const placed = rec.placed
		.map(parsePlaced)
		.filter((piece): piece is PlacedPiece => Boolean(piece));
	const tray = rec.tray.map(parseTray).filter((piece): piece is TrayPiece => Boolean(piece));
	if (placed.length > MAX_PLACED || tray.length > 5) return recoveredWorld();
	if (!uniqueIds([...placed, ...tray])) return recoveredWorld();
	const occ = new Set<string>();
	for (const piece of placed) {
		const cells = worldCells(piece);
		for (const cell of cells) {
			if (!inBounds(cell) || occ.has(cellKey(cell))) return recoveredWorld();
			occ.add(cellKey(cell));
		}
	}
	const undo = Array.isArray(rec.undo)
		? rec.undo
				.map(parseUndo)
				.filter((entry): entry is UndoEntry => Boolean(entry))
				.slice(-MAX_UNDO)
		: [];
	const nextId = Math.max(
		Math.round(clamp(rec.nextId, 1, 10_000, 1)),
		[...placed, ...tray].reduce((max, piece) => {
			const n = Number(String(piece.id).replace(/^p/, ''));
			return Number.isFinite(n) ? Math.max(max, n + 1) : max;
		}, 1)
	);
	const world: World = {
		schema: 1,
		nextId,
		notice: typeof rec.notice === 'string' && rec.notice ? rec.notice : '积木还在桌上。',
		recovered: false,
		placed,
		tray,
		selected: Math.max(
			0,
			Math.min(tray.length ? tray.length - 1 : 0, Math.round(clamp(rec.selected, 0, 4, 0)))
		),
		batchIndex: Math.round(clamp(rec.batchIndex, 0, 16, 0)),
		undo,
		camera: parseCamera(rec.camera)
	};
	if (
		world.tray.length === 0 &&
		world.placed.length < MAX_PLACED &&
		world.placed.length % 5 === 0
	) {
		const next = { n: world.nextId };
		world.tray = makeBatch(world.batchIndex, next);
		world.nextId = next.n;
		world.selected = 0;
	}
	return copyWorld(world);
}

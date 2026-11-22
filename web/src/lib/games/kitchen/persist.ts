import {
	createKitchen,
	dishLabel,
	isFoodKind,
	PAN_CAP,
	PLATE_CAP,
	type FoodKind,
	type KitchenWorld,
	type PanPiece,
	type PlatedDish
} from './sim';

export const KITCHEN_SAVE_KEY = 'qingxin.games.home-kitchen';
export const KITCHEN_SCHEMA = 1;

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

function parsePan(raw: unknown): PanPiece[] {
	if (!Array.isArray(raw)) return [];
	const pieces: PanPiece[] = [];
	for (const item of raw) {
		if (pieces.length >= PAN_CAP) break;
		const rec = asRecord(item);
		if (!rec) continue;
		const kind = String(rec.kind);
		if (!isFoodKind(kind)) continue;
		pieces.push({
			id: String(rec.id || `k${pieces.length + 1}`).slice(0, 24),
			kind,
			doneness: clamp(rec.doneness, 0, 1, 0),
			x: clamp(rec.x, -0.62, 0.62, 0),
			z: clamp(rec.z, -0.62, 0.62, 0)
		});
	}
	return pieces;
}

function parsePlated(raw: unknown): PlatedDish[] {
	if (!Array.isArray(raw)) return [];
	const dishes: PlatedDish[] = [];
	const used = new Set<number>();
	for (const item of raw) {
		if (dishes.length >= PLATE_CAP) break;
		const rec = asRecord(item);
		if (!rec) continue;
		const kinds = Array.isArray(rec.kinds)
			? rec.kinds.map((kind) => String(kind)).filter(isFoodKind)
			: [];
		if (kinds.length === 0) continue;
		let slot = Math.round(clamp(rec.slot, 0, PLATE_CAP - 1, dishes.length));
		while (used.has(slot) && slot < PLATE_CAP) slot += 1;
		if (slot >= PLATE_CAP || used.has(slot)) continue;
		used.add(slot);
		dishes.push({
			id: String(rec.id || `d${dishes.length + 1}`).slice(0, 24),
			slot,
			kinds: kinds as FoodKind[],
			doneness: clamp(rec.doneness, 0, 1, 0),
			label: dishLabel(kinds as FoodKind[])
		});
	}
	return dishes;
}

function keepSettings(world: KitchenWorld, rec: Record<string, unknown>) {
	world.lowDetail = rec.lowDetail === true;
	world.audioWanted = rec.audioWanted === true;
	world.dockCollapsed = rec.dockCollapsed === true;
}

export function serializeKitchen(world: KitchenWorld) {
	return {
		schema: KITCHEN_SCHEMA,
		pan: world.pan.slice(0, PAN_CAP).map((piece) => ({
			id: piece.id,
			kind: piece.kind,
			doneness: piece.doneness,
			x: piece.x,
			z: piece.z
		})),
		plated: world.plated.slice(0, PLATE_CAP).map((dish) => ({
			id: dish.id,
			slot: dish.slot,
			kinds: dish.kinds,
			doneness: dish.doneness,
			label: dish.label
		})),
		lowDetail: world.lowDetail,
		audioWanted: world.audioWanted,
		dockCollapsed: world.dockCollapsed
	};
}

export function writeKitchenSave(
	world: KitchenWorld,
	storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage
) {
	try {
		storage?.setItem(KITCHEN_SAVE_KEY, JSON.stringify(serializeKitchen(world)));
	} catch {
		// private mode / quota
	}
}

function recoveredKitchen(notice: string, rec?: Record<string, unknown> | null) {
	const fresh = createKitchen();
	fresh.recovered = true;
	fresh.notice = notice;
	if (rec) keepSettings(fresh, rec);
	return fresh;
}

export function readKitchenSave(
	storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage
): KitchenWorld {
	try {
		const raw = storage?.getItem(KITCHEN_SAVE_KEY);
		if (!raw) return createKitchen();
		const rec = asRecord(JSON.parse(raw) as unknown);
		if (!rec || rec.schema !== KITCHEN_SCHEMA) {
			return recoveredKitchen('厨房重新收拾好了。', rec);
		}
		const world = createKitchen();
		world.pan = parsePan(rec.pan);
		world.plated = parsePlated(rec.plated);
		keepSettings(world, rec);
		world.nextId =
			world.pan.length +
			world.plated.length +
			world.pan.reduce((best, piece) => Math.max(best, Number(piece.id.slice(1)) || 0), 0) +
			1;
		world.recovered = false;
		world.notice =
			world.pan.length || world.plated.length
				? '灶还热着。锅里和盘子里的还在。'
				: '把菜叶、肉片、蛋、面团、豆腐或虾拖进锅里。文火或武火，炒熟了再盛盘。';
		return world;
	} catch {
		return recoveredKitchen('厨房重新收拾好了。');
	}
}

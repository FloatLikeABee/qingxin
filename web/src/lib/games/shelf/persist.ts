import {
	applyTable,
	createShelf,
	fillHigh,
	hauntIdsOf,
	seedHaunts,
	type ItemKind,
	type PropId,
	type ShelfItem,
	type ShelfWorld
} from './sim';

export const SHELF_SAVE_KEY = 'qingxin.games.memory-shelf';
export const SHELF_SCHEMA = 3;

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

const KINDS = new Set<ItemKind>(['book', 'prop']);
const PROPS = new Set<string>([
	'globe',
	'cup',
	'clock',
	'cat',
	'candle',
	'plant',
	'frame',
	'ink',
	'teapot',
	'moth'
]);

function parseOne(raw: unknown, fallback: ShelfItem): ShelfItem | null {
	const rec = asRecord(raw);
	if (!rec) return null;
	const id = String(rec.id ?? fallback.id);
	const kind = String(rec.kind ?? fallback.kind);
	const item: ShelfItem = {
		...fallback,
		id: fallback.id,
		kind: KINDS.has(kind as ItemKind) ? (kind as ItemKind) : fallback.kind,
		title: String(rec.title ?? fallback.title).slice(0, 12),
		tone: clamp(rec.tone, 0, 1, fallback.tone),
		row: clamp(rec.row, 0, 7, fallback.row),
		slot: clamp(rec.slot, 0, 7, fallback.slot),
		tall: clamp(rec.tall, 0.2, 0.8, fallback.tall),
		thick: clamp(rec.thick, 0.08, 0.4, fallback.thick)
	};
	const prop = String(rec.prop ?? fallback.prop ?? '');
	if (item.kind === 'prop' && PROPS.has(prop)) item.prop = prop as PropId;
	return { ...item, id };
}

function parseItemsById(raw: unknown, template: ShelfItem[]): ShelfItem[] {
	const saved = new Map<string, Record<string, unknown>>();
	if (Array.isArray(raw)) {
		for (const entry of raw) {
			const rec = asRecord(entry);
			if (!rec || rec.id == null) continue;
			saved.set(String(rec.id), rec);
		}
	}
	const usedSlots = new Set<string>();
	const out: ShelfItem[] = [];
	for (const base of template) {
		const rec = saved.get(base.id);
		let item = rec ? parseOne(rec, base) ?? { ...base } : { ...base };
		item = { ...item, id: base.id };
		if (item.row > 5 || item.slot > 7) {
			item.row = base.row;
			item.slot = base.slot;
		}
		let key = `${item.row}:${item.slot}`;
		if (usedSlots.has(key)) {
			item.row = base.row;
			item.slot = base.slot;
			key = `${item.row}:${item.slot}`;
		}
		if (usedSlots.has(key)) {
			let found = false;
			for (let row = 0; row < 6 && !found; row++) {
				for (let slot = 0; slot < 8; slot++) {
					const next = `${row}:${slot}`;
					if (!usedSlots.has(next)) {
						item.row = row;
						item.slot = slot;
						key = next;
						found = true;
						break;
					}
				}
			}
		}
		usedSlots.add(key);
		out.push(item);
	}
	return out;
}

export function serializeShelf(world: ShelfWorld) {
	return {
		schema: SHELF_SCHEMA,
		items: world.items,
		hauntIds: hauntIdsOf(world),
		coolIds: world.coolIds,
		lastHauntIds: world.lastHauntIds,
		round: world.round,
		lowDetail: world.lowDetail,
		audioWanted: world.audioWanted,
		dockCollapsed: world.dockCollapsed
	};
}

export function writeShelfSave(
	world: ShelfWorld,
	storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage,
	extra: Record<string, unknown> = {}
) {
	try {
		storage?.setItem(SHELF_SAVE_KEY, JSON.stringify({ ...serializeShelf(world), ...extra }));
	} catch {
		// private mode / quota
	}
}

function keepSettings(fresh: ShelfWorld, rec: Record<string, unknown>) {
	fresh.lowDetail = rec.lowDetail === true;
	fresh.audioWanted = rec.audioWanted === true;
	fresh.dockCollapsed = rec.dockCollapsed === true;
}

function applyHauntIds(fresh: ShelfWorld, rec: Record<string, unknown>, fromSchema2: boolean) {
	const books = new Set(fresh.items.filter((i) => i.kind === 'book').map((i) => i.id));
	let ids: string[] = [];
	if (Array.isArray(rec.hauntIds)) {
		ids = rec.hauntIds.map((id) => String(id)).filter((id) => books.has(id));
	} else if (fromSchema2 || rec.hauntId != null) {
		const one = String(rec.hauntId ?? '');
		if (books.has(one)) ids = [one];
	}
	fresh.haunts = [];
	fresh.coolIds = Array.isArray(rec.coolIds)
		? rec.coolIds.map((id) => String(id)).filter((id) => books.has(id) && !ids.includes(id))
		: [];
	for (const id of ids.slice(0, 4)) {
		fresh.haunts.push({ bookId: id, phase: 'idle', phaseT: 0 });
	}
	seedHaunts(fresh, Math.random, ids);
}

export function readShelfSave(
	storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage
): ShelfWorld {
	const fresh = createShelf();
	try {
		const raw = storage?.getItem(SHELF_SAVE_KEY);
		if (!raw) return fresh;
		const rec = asRecord(JSON.parse(raw) as unknown);
		if (!rec) {
			fresh.recovered = true;
			fresh.notice = '书房的记事读不出来，货架重新摆好了。';
			return fresh;
		}
		if (rec.schema === 1) {
			keepSettings(fresh, rec);
			applyTable(fresh);
			fresh.recovered = true;
			fresh.notice = '货架换了样子，书还在等你摆。';
			writeShelfSave(fresh, storage, { flash: 'migrated' });
			return fresh;
		}
		if (rec.schema !== 2 && rec.schema !== SHELF_SCHEMA) {
			fresh.recovered = true;
			fresh.notice = '货架换了样子，书还在等你摆。';
			return fresh;
		}
		const fromSchema2 = rec.schema === 2;
		fresh.items = parseItemsById(rec.items, fillHigh());
		keepSettings(fresh, rec);
		applyHauntIds(fresh, rec, fromSchema2);
		applyTable(fresh);
		fresh.round = clamp(rec.round, 0, 99, 0);
		if (rec.flash === 'migrated') {
			fresh.recovered = true;
			fresh.notice = '货架换了样子，书还在等你摆。';
		} else if (fromSchema2) {
			fresh.recovered = false;
			fresh.notice = '货架又添了几格。';
			writeShelfSave(fresh, storage);
		} else {
			fresh.recovered = false;
			fresh.notice = `书柜还记得你。这是第 ${fresh.round + 1} 轮。`;
		}
		return fresh;
	} catch {
		fresh.recovered = true;
		fresh.notice = '书房的记事读不出来，货架重新摆好了。';
		return fresh;
	}
}

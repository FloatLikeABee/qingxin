import {
	ROWS,
	SLOTS,
	createShelf,
	type HauntPhase,
	type ItemKind,
	type PropId,
	type ShelfItem,
	type ShelfWorld
} from './sim';

export const SHELF_SAVE_KEY = 'qingxin.games.memory-shelf';
export const SHELF_SCHEMA = 2;

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
const PHASES = new Set<HauntPhase>(['idle', 'emerge', 'face', 'cry', 'sorry', 'retreat', 'done']);
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

function parseItems(raw: unknown, fallback: ShelfItem[]): ShelfItem[] {
	if (!Array.isArray(raw) || raw.length !== fallback.length) {
		return fallback.map((item) => ({ ...item }));
	}
	const used = new Set<string>();
	return fallback.map((base, i) => {
		const rec = asRecord(raw[i]);
		const id = String(rec?.id ?? base.id);
		if (used.has(id)) return { ...base };
		used.add(id);
		const kind = String(rec?.kind ?? base.kind);
		const item: ShelfItem = {
			...base,
			id: fallback.some((f) => f.id === id) ? id : base.id,
			kind: KINDS.has(kind as ItemKind) ? (kind as ItemKind) : base.kind,
			title: String(rec?.title ?? base.title).slice(0, 12),
			tone: clamp(rec?.tone, 0, 1, base.tone),
			row: clamp(rec?.row, 0, ROWS - 1, base.row),
			slot: clamp(rec?.slot, 0, SLOTS - 1, base.slot),
			tall: clamp(rec?.tall, 0.2, 0.8, base.tall),
			thick: clamp(rec?.thick, 0.08, 0.4, base.thick)
		};
		const prop = String(rec?.prop ?? base.prop ?? '');
		if (item.kind === 'prop' && PROPS.has(prop)) item.prop = prop as PropId;
		return item;
	});
}

export function serializeShelf(world: ShelfWorld) {
	return {
		schema: SHELF_SCHEMA,
		items: world.items,
		hauntId: world.hauntId,
		lastHauntId: world.lastHauntId,
		phase: world.phase === 'idle' || world.phase === 'done' ? world.phase : 'idle',
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
			fresh.recovered = true;
			fresh.notice = '货架换了样子，书还在等你摆。';
			writeShelfSave(fresh, storage, { flash: 'migrated' });
			return fresh;
		}
		if (rec.schema !== SHELF_SCHEMA) {
			fresh.recovered = true;
			fresh.notice = '货架换了样子，书还在等你摆。';
			return fresh;
		}
		fresh.items = parseItems(rec.items, fresh.items);
		const haunt = String(rec.hauntId ?? '');
		if (fresh.items.some((i) => i.id === haunt && i.kind === 'book')) fresh.hauntId = haunt;
		const last = rec.lastHauntId == null ? null : String(rec.lastHauntId);
		fresh.lastHauntId = last && fresh.items.some((i) => i.id === last) ? last : null;
		const phase = String(rec.phase);
		fresh.phase = PHASES.has(phase as HauntPhase) ? (phase as HauntPhase) : 'idle';
		if (fresh.phase !== 'idle' && fresh.phase !== 'done') fresh.phase = 'idle';
		fresh.round = clamp(rec.round, 0, 99, 0);
		keepSettings(fresh, rec);
		if (rec.flash === 'migrated') {
			fresh.recovered = true;
			fresh.notice = '货架换了样子，书还在等你摆。';
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

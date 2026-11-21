import { createOp, hydrateOp, type OpWorld, type RegionId } from './sim';

export const OP_KEY = 'qingxin.games.operation';
export const OP_SCHEMA = 1 as const;

export type OpSave = {
	schema: typeof OP_SCHEMA;
	graphicAck: boolean;
	stars: Record<RegionId, number>;
	lastSeed: number;
	audioWanted: boolean;
	lessSpray: boolean;
	lowDetail: boolean;
	dockCollapsed: boolean;
};

export function emptyOpSave(): OpSave {
	return {
		schema: OP_SCHEMA,
		graphicAck: false,
		stars: { forearm: 0, knee: 0, tooth: 0, belly: 0 },
		lastSeed: 1,
		audioWanted: false,
		lessSpray: false,
		lowDetail: false,
		dockCollapsed: false
	};
}

function asStars(raw: unknown): Record<RegionId, number> {
	const d = emptyOpSave().stars;
	if (!raw || typeof raw !== 'object') return d;
	const o = raw as Record<string, unknown>;
	for (const id of ['forearm', 'knee', 'tooth', 'belly'] as const) {
		const n = o[id];
		if (typeof n === 'number' && Number.isFinite(n)) d[id] = Math.max(0, Math.min(3, Math.floor(n)));
	}
	return d;
}

export function parseOpSave(raw: unknown): { save: OpSave; recovered: boolean } {
	if (!raw || typeof raw !== 'object') return { save: emptyOpSave(), recovered: true };
	const o = raw as Record<string, unknown>;
	if (o.schema !== OP_SCHEMA) return { save: emptyOpSave(), recovered: true };
	return {
		save: {
			schema: OP_SCHEMA,
			graphicAck: o.graphicAck === true,
			stars: asStars(o.stars),
			lastSeed: typeof o.lastSeed === 'number' && Number.isFinite(o.lastSeed) ? o.lastSeed >>> 0 || 1 : 1,
			audioWanted: o.audioWanted === true,
			lessSpray: o.lessSpray === true,
			lowDetail: o.lowDetail === true,
			dockCollapsed: o.dockCollapsed === true
		},
		recovered: false
	};
}

export function snapshotOp(world: OpWorld): OpSave {
	return {
		schema: OP_SCHEMA,
		graphicAck: world.graphicAck,
		stars: { ...world.stars },
		lastSeed: world.lastSeed,
		audioWanted: world.audioWanted,
		lessSpray: world.lessSpray,
		lowDetail: world.lowDetail,
		dockCollapsed: world.dockCollapsed
	};
}

export function applyOpSave(world: OpWorld, save: OpSave, recovered: boolean) {
	hydrateOp(world, {
		graphicAck: save.graphicAck,
		stars: { ...save.stars },
		lastSeed: save.lastSeed,
		seed: save.lastSeed,
		audioWanted: save.audioWanted,
		lessSpray: save.lessSpray,
		lowDetail: save.lowDetail,
		dockCollapsed: save.dockCollapsed,
		recovered
	});
}

export function loadOpSave(storage: Pick<Storage, 'getItem'> | null): {
	world: OpWorld;
	recovered: boolean;
} {
	const world = createOp(1);
	if (!storage) return { world, recovered: false };
	let parsed: unknown = null;
	try {
		const raw = storage.getItem(OP_KEY);
		parsed = raw ? JSON.parse(raw) : null;
	} catch {
		applyOpSave(world, emptyOpSave(), true);
		return { world, recovered: true };
	}
	if (parsed == null) return { world, recovered: false };
	const { save, recovered } = parseOpSave(parsed);
	applyOpSave(world, save, recovered);
	return { world, recovered };
}

export function writeOpSave(storage: Pick<Storage, 'setItem'> | null, world: OpWorld) {
	if (!storage) return;
	try {
		storage.setItem(OP_KEY, JSON.stringify(snapshotOp(world)));
	} catch {
		/* private mode */
	}
}

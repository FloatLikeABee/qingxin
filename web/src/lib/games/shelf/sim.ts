export const HIGH_ROWS = 6;
export const HIGH_SLOTS = 8;
export const LOW_ROWS = 5;
export const LOW_SLOTS = 6;
export const HIGH_HAUNT_CAP = 4;
export const LOW_HAUNT_CAP = 2;
export const ROWS = HIGH_ROWS;
export const SLOTS = HIGH_SLOTS;
export const DT_CAP = 48;

export type HauntPhase = 'idle' | 'emerge' | 'face' | 'cry' | 'sorry' | 'retreat' | 'done';
export type ItemKind = 'book' | 'prop';
export type PropId =
	| 'globe'
	| 'cup'
	| 'clock'
	| 'cat'
	| 'candle'
	| 'plant'
	| 'frame'
	| 'ink'
	| 'teapot'
	| 'moth';

export type ShelfItem = {
	id: string;
	kind: ItemKind;
	title: string;
	prop?: PropId;
	tone: number;
	row: number;
	slot: number;
	tall: number;
	thick: number;
};

export type Haunt = {
	bookId: string;
	phase: HauntPhase;
	phaseT: number;
};

export type ShelfWorld = {
	items: ShelfItem[];
	haunts: Haunt[];
	coolIds: string[];
	lastHauntIds: string[];
	heldId: string | null;
	notice: string;
	paused: boolean;
	over: boolean;
	lowDetail: boolean;
	narrow: boolean;
	reducedMotion: boolean;
	audioWanted: boolean;
	dockCollapsed: boolean;
	recovered: boolean;
	round: number;
	t: number;
};

const BOOK_TITLES = [
	'夜航',
	'茶经',
	'闲书',
	'雨巷',
	'旧信',
	'灯下',
	'航海',
	'本草',
	'猫语',
	'小诗',
	'炉边',
	'溪声',
	'纸船',
	'秋窗',
	'眠歌',
	'远山',
	'青灯',
	'竹影',
	'归巢',
	'暖雪',
	'书虫',
	'晚风',
	'窗花',
	'谷雨',
	'蝉鸣',
	'枕书',
	'燕归',
	'露台',
	'折扇',
	'墨痕',
	'槐夏',
	'灯花',
	'苔痕',
	'芦花',
	'松风',
	'雪夜'
];

const PROP_ON_SHELF: Array<{ title: string; prop: PropId }> = [
	{ title: '地球仪', prop: 'globe' },
	{ title: '茶杯', prop: 'cup' },
	{ title: '座钟', prop: 'clock' },
	{ title: '瓷猫', prop: 'cat' },
	{ title: '烛台', prop: 'candle' },
	{ title: '绿植', prop: 'plant' },
	{ title: '小像框', prop: 'frame' },
	{ title: '墨水瓶', prop: 'ink' },
	{ title: '茶壶', prop: 'teapot' },
	{ title: '蛾标本', prop: 'moth' },
	{ title: '旧地球仪', prop: 'globe' },
	{ title: '小茶杯', prop: 'cup' }
];

const PHASE_MS: Record<Exclude<HauntPhase, 'idle' | 'done'>, number> = {
	emerge: 720,
	face: 480,
	cry: 1200,
	sorry: 1400,
	retreat: 820
};

const PHASE_MS_REDUCED: Record<Exclude<HauntPhase, 'idle' | 'done'>, number> = {
	emerge: 220,
	face: 180,
	cry: 360,
	sorry: 900,
	retreat: 260
};

const PLAYING: HauntPhase[] = ['emerge', 'face', 'cry', 'sorry', 'retreat'];

function dur(world: ShelfWorld, phase: Exclude<HauntPhase, 'idle' | 'done'>) {
	return world.reducedMotion ? PHASE_MS_REDUCED[phase] : PHASE_MS[phase];
}

function nextPhase(phase: HauntPhase): HauntPhase {
	if (phase === 'emerge') return 'face';
	if (phase === 'face') return 'cry';
	if (phase === 'cry') return 'sorry';
	if (phase === 'sorry') return 'retreat';
	if (phase === 'retreat') return 'done';
	return phase;
}

export function fillHigh(): ShelfItem[] {
	const items: ShelfItem[] = [];
	let bookI = 0;
	let propI = 0;
	for (let row = 0; row < HIGH_ROWS; row++) {
		for (let slot = 0; slot < HIGH_SLOTS; slot++) {
			const propHere = (row + slot) % 4 === 0 && propI < 12;
			if (propHere) {
				const spec = PROP_ON_SHELF[propI % PROP_ON_SHELF.length]!;
				items.push({
					id: `p${propI}`,
					kind: 'prop',
					title: spec.title,
					prop: spec.prop,
					tone: 0.12 + (propI % 7) * 0.1,
					row,
					slot,
					tall: 0.42,
					thick: 0.28
				});
				propI += 1;
			} else {
				items.push({
					id: `b${bookI}`,
					kind: 'book',
					title: BOOK_TITLES[bookI % BOOK_TITLES.length]!,
					tone: (bookI * 0.17) % 1,
					row,
					slot,
					tall: 0.48 + (bookI % 4) * 0.04,
					thick: 0.24 + (bookI % 3) * 0.05
				});
				bookI += 1;
			}
		}
	}
	return items;
}

export function isCompact(world: Pick<ShelfWorld, 'lowDetail' | 'narrow' | 'reducedMotion'>) {
	return world.lowDetail || world.narrow || world.reducedMotion;
}

export function tableOf(world: Pick<ShelfWorld, 'lowDetail' | 'narrow' | 'reducedMotion'>) {
	return isCompact(world)
		? { rows: LOW_ROWS, slots: LOW_SLOTS, cap: LOW_HAUNT_CAP }
		: { rows: HIGH_ROWS, slots: HIGH_SLOTS, cap: HIGH_HAUNT_CAP };
}

export function visibleItems(world: ShelfWorld) {
	const { rows, slots } = tableOf(world);
	return world.items.filter((item) => item.row >= 0 && item.row < rows && item.slot >= 0 && item.slot < slots);
}

export function hauntIdsOf(world: ShelfWorld) {
	return world.haunts.map((h) => h.bookId);
}

export function hauntOf(world: ShelfWorld, bookId: string) {
	return world.haunts.find((h) => h.bookId === bookId);
}

export function shelfPhase(world: ShelfWorld): HauntPhase {
	const playing = world.haunts.find((h) => PLAYING.includes(h.phase));
	if (playing) return playing.phase;
	return 'idle';
}

export function anyApology(world: ShelfWorld) {
	return world.haunts.some((h) => h.phase === 'sorry');
}

function inTable(world: ShelfWorld, item: ShelfItem) {
	const { rows, slots } = tableOf(world);
	return item.row >= 0 && item.row < rows && item.slot >= 0 && item.slot < slots;
}

function eligibleBooks(world: ShelfWorld, extraSkip: string[] = []) {
	const skip = new Set([...hauntIdsOf(world), ...world.coolIds, ...extraSkip]);
	return world.items.filter((item) => item.kind === 'book' && inTable(world, item) && !skip.has(item.id));
}

export function seedHaunts(world: ShelfWorld, rng: () => number = Math.random, skip: string[] = []) {
	const cap = tableOf(world).cap;
	while (world.haunts.length < cap) {
		let pool = eligibleBooks(world, skip);
		if (pool.length === 0) {
			const busy = new Set(hauntIdsOf(world));
			world.coolIds = world.coolIds.filter((id) => busy.has(id));
			pool = eligibleBooks(world, skip);
			if (pool.length === 0) break;
		}
		const pick = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]!;
		world.haunts.push({ bookId: pick.id, phase: 'idle', phaseT: 0 });
	}
}

export function applyTable(world: ShelfWorld, rng: () => number = Math.random) {
	world.haunts = world.haunts.filter((h) => {
		const item = findItem(world, h.bookId);
		return item ? inTable(world, item) : false;
	});
	const cap = tableOf(world).cap;
	if (world.haunts.length > cap) {
		const extra = world.haunts.slice(cap);
		world.haunts = world.haunts.slice(0, cap);
		for (const h of extra) {
			if (!world.coolIds.includes(h.bookId)) world.coolIds.push(h.bookId);
		}
	}
	seedHaunts(world, rng);
}

export function createShelf(rng: () => number = Math.random): ShelfWorld {
	const world: ShelfWorld = {
		items: fillHigh(),
		haunts: [],
		coolIds: [],
		lastHauntIds: [],
		heldId: null,
		notice: '拿起书和旧物，摆到喜欢的格子。最多四只鬼会同时钻出来道歉。',
		paused: false,
		over: false,
		lowDetail: false,
		narrow: false,
		reducedMotion: false,
		audioWanted: false,
		dockCollapsed: false,
		recovered: false,
		round: 0,
		t: 0
	};
	seedHaunts(world, rng);
	return world;
}

export function itemAt(world: ShelfWorld, row: number, slot: number) {
	return world.items.find((i) => i.row === row && i.slot === slot);
}

export function shelfLayout(world: ShelfWorld) {
	return world.items.map((i) => `${i.id}:${i.row}:${i.slot}`).sort();
}

export function findItem(world: ShelfWorld, id: string) {
	return world.items.find((i) => i.id === id);
}

function isPlayingHaunt(world: ShelfWorld, id: string) {
	const haunt = hauntOf(world, id);
	return Boolean(haunt && PLAYING.includes(haunt.phase));
}

export function pickItem(world: ShelfWorld, id: string) {
	if (world.paused) return;
	const item = findItem(world, id);
	if (!item) return;
	if (isPlayingHaunt(world, id)) return;
	const haunt = hauntOf(world, id);
	if (haunt && haunt.phase === 'idle' && item.kind === 'book') {
		haunt.phase = 'emerge';
		haunt.phaseT = 0;
		world.notice = '这本书里钻出了谁？';
		return;
	}
	world.heldId = id;
	world.notice = `拿起了${item.title}。拖到格子上放下。`;
}

export function placeHeld(world: ShelfWorld, row: number, slot: number) {
	if (world.paused || !world.heldId) return;
	const { rows, slots } = tableOf(world);
	if (row < 0 || row >= rows || slot < 0 || slot >= slots) return;
	const held = findItem(world, world.heldId);
	if (!held) {
		world.heldId = null;
		return;
	}
	if (isPlayingHaunt(world, held.id)) return;
	const occupant = itemAt(world, row, slot);
	if (occupant && isPlayingHaunt(world, occupant.id)) return;
	if (occupant && occupant.id !== held.id) {
		const fromRow = held.row;
		const fromSlot = held.slot;
		held.row = row;
		held.slot = slot;
		occupant.row = fromRow;
		occupant.slot = fromSlot;
		world.notice = `${held.title}和${occupant.title}换了位置。`;
	} else {
		world.notice = `${held.title}放回原处。`;
	}
	world.heldId = null;
}

function finishHaunt(world: ShelfWorld, haunt: Haunt, rng: () => number) {
	const bookId = haunt.bookId;
	world.haunts = world.haunts.filter((h) => h.bookId !== bookId);
	if (!world.coolIds.includes(bookId)) world.coolIds.push(bookId);
	world.notice = '它钻回去了。这本书暂时不会再钻出来。';
	seedHaunts(world, rng, [bookId]);
}

function tickHaunt(world: ShelfWorld, haunt: Haunt, slice: number, rng: () => number) {
	if (!PLAYING.includes(haunt.phase)) return;
	haunt.phaseT += slice;
	if (haunt.phase === 'sorry') world.notice = '对不起！';
	const need = dur(world, haunt.phase as Exclude<HauntPhase, 'idle' | 'done'>);
	if (haunt.phaseT < need) return;
	haunt.phaseT = 0;
	const next = nextPhase(haunt.phase);
	if (next === 'done') {
		finishHaunt(world, haunt, rng);
		return;
	}
	haunt.phase = next;
	if (haunt.phase === 'sorry') world.notice = '对不起！';
}

function tick(world: ShelfWorld, slice: number, rng: () => number) {
	world.t += slice;
	for (const haunt of [...world.haunts]) {
		tickHaunt(world, haunt, slice, rng);
	}
}

export function stepShelf(world: ShelfWorld, dt: number, rng: () => number = Math.random) {
	if (world.paused) return;
	let left = Math.max(0, dt);
	while (left > 0) {
		const slice = Math.min(DT_CAP, left);
		tick(world, slice, rng);
		left -= slice;
	}
}

export function nextRound(world: ShelfWorld, rng: () => number = Math.random) {
	world.lastHauntIds = hauntIdsOf(world);
	world.coolIds = [...world.lastHauntIds];
	world.haunts = [];
	world.heldId = null;
	world.round += 1;
	seedHaunts(world, rng);
	world.notice = '换了一批闹鬼的书。你摆过的还在。';
}

export function restartShelf(world: ShelfWorld, rng: () => number = Math.random) {
	const next = createShelf(rng);
	next.lowDetail = world.lowDetail;
	next.narrow = world.narrow;
	next.audioWanted = world.audioWanted;
	next.dockCollapsed = world.dockCollapsed;
	next.reducedMotion = world.reducedMotion;
	Object.assign(world, next);
	applyTable(world, rng);
}

export function isHaunting(world: ShelfWorld) {
	return world.haunts.some((h) => PLAYING.includes(h.phase));
}

export function hauntProgress(world: ShelfWorld, bookId?: string) {
	const haunt = bookId
		? hauntOf(world, bookId)
		: world.haunts.find((h) => PLAYING.includes(h.phase));
	if (!haunt) return 0;
	if (haunt.phase === 'done' || haunt.phase === 'idle') return haunt.phase === 'done' ? 1 : 0;
	const need = dur(world, haunt.phase);
	return Math.min(1, haunt.phaseT / need);
}

export function slotWorld(row: number, slot: number, compact = false) {
	const slots = compact ? LOW_SLOTS : HIGH_SLOTS;
	const gapX = compact ? 0.34 : 0.3;
	const gapY = compact ? 0.5 : 0.46;
	return {
		x: (slot - (slots - 1) / 2) * gapX,
		y: 0.46 + row * gapY,
		z: -1.72
	};
}

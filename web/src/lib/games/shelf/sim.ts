export const ROWS = 4;
export const SLOTS = 7;
export const DT_CAP = 48;

export type HauntPhase = 'idle' | 'emerge' | 'face' | 'cry' | 'sorry' | 'retreat' | 'done';
export type ItemKind = 'book' | 'prop';
export type PropId =
	'globe' | 'cup' | 'clock' | 'cat' | 'candle' | 'plant' | 'frame' | 'ink' | 'teapot' | 'moth';

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

export type ShelfWorld = {
	items: ShelfItem[];
	hauntId: string;
	lastHauntId: string | null;
	phase: HauntPhase;
	phaseT: number;
	round: number;
	heldId: string | null;
	notice: string;
	apology: boolean;
	paused: boolean;
	over: boolean;
	lowDetail: boolean;
	reducedMotion: boolean;
	audioWanted: boolean;
	dockCollapsed: boolean;
	recovered: boolean;
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
	'晚风'
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
	{ title: '蛾标本', prop: 'moth' }
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

function fillShelf(): ShelfItem[] {
	const items: ShelfItem[] = [];
	let bookI = 0;
	let propI = 0;
	for (let row = 0; row < ROWS; row++) {
		for (let slot = 0; slot < SLOTS; slot++) {
			const propHere = (row + slot) % 4 === 0 && propI < 6;
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

function booksOf(world: ShelfWorld, except?: string | null) {
	return world.items.filter((i) => i.kind === 'book' && i.id !== except);
}

function chooseHaunt(world: ShelfWorld, rng: () => number, except?: string | null) {
	const books = booksOf(world, except);
	if (books.length === 0) return world.hauntId;
	const pick = books[Math.min(books.length - 1, Math.floor(rng() * books.length))]!;
	return pick.id;
}

export function createShelf(rng: () => number = Math.random): ShelfWorld {
	const items = fillShelf();
	const world: ShelfWorld = {
		items,
		hauntId: '',
		lastHauntId: null,
		phase: 'idle',
		phaseT: 0,
		round: 0,
		heldId: null,
		notice: '拿起书和旧物，摆到喜欢的格子。每轮只有一本会闹鬼。',
		apology: false,
		paused: false,
		over: false,
		lowDetail: false,
		reducedMotion: false,
		audioWanted: false,
		dockCollapsed: false,
		recovered: false,
		t: 0
	};
	world.hauntId = chooseHaunt(world, rng, null);
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

function playing(world: ShelfWorld) {
	return PLAYING.includes(world.phase);
}

export function pickItem(world: ShelfWorld, id: string) {
	if (world.paused) return;
	if (playing(world)) return;
	const item = findItem(world, id);
	if (!item) return;
	world.heldId = id;
	if (item.kind === 'book' && item.id === world.hauntId && world.phase === 'idle') {
		world.phase = 'emerge';
		world.phaseT = 0;
		world.apology = false;
		world.notice = '这本书里钻出了谁？';
		return;
	}
	world.notice = `拿起了${item.title}。拖到格子上放下。`;
}

export function placeHeld(world: ShelfWorld, row: number, slot: number) {
	if (world.paused || !world.heldId) return;
	if (playing(world)) return;
	if (row < 0 || row >= ROWS || slot < 0 || slot >= SLOTS) return;
	const held = findItem(world, world.heldId);
	if (!held) {
		world.heldId = null;
		return;
	}
	const occupant = itemAt(world, row, slot);
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

function tick(world: ShelfWorld, slice: number) {
	world.t += slice;
	if (!playing(world)) {
		world.apology = false;
		return;
	}
	world.phaseT += slice;
	world.apology = world.phase === 'sorry';
	if (world.phase === 'sorry') world.notice = '对不起！';
	const need = dur(world, world.phase as Exclude<HauntPhase, 'idle' | 'done'>);
	if (world.phaseT < need) return;
	world.phaseT = 0;
	world.phase = nextPhase(world.phase);
	world.apology = world.phase === 'sorry';
	if (world.phase === 'done') {
		world.notice = '它钻回去了。这本书这轮不会再吓你。';
		world.apology = false;
	}
}

export function stepShelf(world: ShelfWorld, dt: number) {
	if (world.paused) return;
	let left = Math.max(0, dt);
	while (left > 0) {
		const slice = Math.min(DT_CAP, left);
		tick(world, slice);
		left -= slice;
	}
}

export function nextRound(world: ShelfWorld, rng: () => number = Math.random) {
	if (world.phase !== 'done') return;
	world.lastHauntId = world.hauntId;
	world.hauntId = chooseHaunt(world, rng, world.lastHauntId);
	world.phase = 'idle';
	world.phaseT = 0;
	world.apology = false;
	world.heldId = null;
	world.round += 1;
	world.notice = '换了一本闹鬼的书。你摆过的还在。';
}

export function restartShelf(world: ShelfWorld, rng: () => number = Math.random) {
	const next = createShelf(rng);
	next.lowDetail = world.lowDetail;
	next.audioWanted = world.audioWanted;
	next.dockCollapsed = world.dockCollapsed;
	Object.assign(world, next);
}

export function isHaunting(world: ShelfWorld) {
	return PLAYING.includes(world.phase);
}

export function hauntProgress(world: ShelfWorld) {
	if (world.phase === 'done') return 1;
	if (!isHaunting(world)) return 0;
	const need = dur(world, world.phase as Exclude<HauntPhase, 'idle' | 'done'>);
	return Math.min(1, world.phaseT / need);
}

export function slotWorld(row: number, slot: number) {
	return {
		x: (slot - (SLOTS - 1) / 2) * 0.36,
		y: 0.52 + row * 0.58,
		z: -1.72
	};
}

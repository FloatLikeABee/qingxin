export const COLS = 4;
export const ROWS = 3;

export type NightMotif = 'moon' | 'stars' | 'cloud' | 'tower' | 'windows' | 'street' | 'sill';

export interface NightCell {
	index: number;
	col: number;
	row: number;
	motif: NightMotif;
	hue: number;
}

export interface NightPiece {
	id: string;
	home: number;
	motif: NightMotif;
	hue: number;
}

export interface NightState {
	cells: NightCell[];
	tray: NightPiece[];
	slots: Array<string | null>;
	misses: number;
	tick: number;
	complete: boolean;
	paused: boolean;
	gustEvery: number;
	rng: () => number;
}

export interface NightOptions {
	seed?: number;
}

const LAYOUT: NightMotif[] = [
	'moon',
	'stars',
	'stars',
	'cloud',
	'stars',
	'tower',
	'tower',
	'cloud',
	'sill',
	'windows',
	'windows',
	'street'
];

function mulberry32(seed: number): () => number {
	let t = seed >>> 0;
	return () => {
		t += 0x6d2b79f5;
		let n = t;
		n = Math.imul(n ^ (n >>> 15), n | 1);
		n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
		return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffle<T>(items: T[], rng: () => number): T[] {
	const next = [...items];
	for (let i = next.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		const a = next[i];
		const b = next[j];
		if (a === undefined || b === undefined) continue;
		next[i] = b;
		next[j] = a;
	}
	return next;
}

export function createNight(options: NightOptions = {}): NightState {
	const rng = mulberry32(options.seed ?? 20261113);
	const cells: NightCell[] = LAYOUT.map((motif, index) => ({
		index,
		col: index % COLS,
		row: Math.floor(index / COLS),
		motif,
		hue: rng()
	}));
	const pieces: NightPiece[] = cells.map((cell) => ({
		id: `shard-${cell.index}`,
		home: cell.index,
		motif: cell.motif,
		hue: cell.hue
	}));
	return {
		cells,
		tray: shuffle(pieces, rng),
		slots: Array.from({ length: COLS * ROWS }, () => null),
		misses: 0,
		tick: 0,
		complete: false,
		paused: false,
		gustEvery: 48,
		rng
	};
}

export function placeShard(night: NightState, pieceId: string, slot: number): boolean {
	if (night.complete || night.paused) return false;
	if (slot < 0 || slot >= night.slots.length) return false;
	if (night.slots[slot]) return false;
	const index = night.tray.findIndex((piece) => piece.id === pieceId);
	const piece = index >= 0 ? night.tray[index] : undefined;
	if (!piece) return false;
	if (piece.home !== slot) {
		night.misses += 1;
		return false;
	}
	night.slots[slot] = piece.id;
	night.tray.splice(index, 1);
	if (night.slots.every(Boolean)) night.complete = true;
	return true;
}

export function isComplete(night: NightState): boolean {
	return night.complete;
}

export function gust(night: NightState) {
	if (night.complete || night.paused) return;
	night.tray = shuffle(night.tray, night.rng);
}

export function tickNight(night: NightState): NightState {
	if (night.paused || night.complete) return night;
	night.tick += 1;
	if (night.tick % night.gustEvery === 0) gust(night);
	return night;
}

export function restartNight(night: NightState, options?: NightOptions): NightState {
	Object.assign(night, createNight(options));
	return night;
}

export function motifLabel(motif: NightMotif): string {
	const labels: Record<NightMotif, string> = {
		moon: '月亮',
		stars: '星河',
		cloud: '夜云',
		tower: '远楼',
		windows: '灯窗',
		street: '街灯',
		sill: '窗台'
	};
	return labels[motif];
}

export const PAN_CAP = 12;
export const PLATE_CAP = 8;
export const FOOD_KINDS = ['veg', 'meat', 'egg', 'dough', 'tofu', 'shrimp'] as const;
export type FoodKind = (typeof FOOD_KINDS)[number];
export type Heat = 'off' | 'low' | 'high';
export type Held = { source: 'bowl'; kind: FoodKind } | { source: 'pan'; id: string } | null;

export type PanPiece = {
	id: string;
	kind: FoodKind;
	doneness: number;
	x: number;
	z: number;
};

export type PlatedDish = {
	id: string;
	slot: number;
	kinds: FoodKind[];
	doneness: number;
	label: string;
};

export type KitchenWorld = {
	pan: PanPiece[];
	plated: PlatedDish[];
	heat: Heat;
	held: Held;
	notice: string;
	paused: boolean;
	lowDetail: boolean;
	audioWanted: boolean;
	dockCollapsed: boolean;
	recovered: boolean;
	t: number;
	nextId: number;
};

export const FOOD_LABEL: Record<FoodKind, string> = {
	veg: '菜叶',
	meat: '肉片',
	egg: '蛋',
	dough: '面团',
	tofu: '豆腐',
	shrimp: '虾'
};

export const HEAT_LABEL: Record<Heat, string> = {
	off: '关火',
	low: '文火',
	high: '武火'
};

export const COOK_RATE: Record<Heat, number> = {
	off: 0,
	low: 0.000055,
	high: 0.00018
};

const RAW: Record<FoodKind, number> = {
	veg: 0x4caf50,
	meat: 0xe38a8a,
	egg: 0xf4e8c1,
	dough: 0xe8d5b5,
	tofu: 0xf5f0e6,
	shrimp: 0xe8b4a0
};

const COOKED: Record<FoodKind, number> = {
	veg: 0x2e5a28,
	meat: 0x6b3a22,
	egg: 0xd4a017,
	dough: 0xc47a3a,
	tofu: 0xe0c070,
	shrimp: 0xd45a2a
};

const KINDS = new Set<string>(FOOD_KINDS);

export function isFoodKind(value: string): value is FoodKind {
	return KINDS.has(value);
}

function clamp(n: number, min: number, max: number) {
	return Math.min(max, Math.max(min, n));
}

function lerpColor(a: number, b: number, t: number) {
	const u = clamp(t, 0, 1);
	const ar = (a >> 16) & 255;
	const ag = (a >> 8) & 255;
	const ab = a & 255;
	const br = (b >> 16) & 255;
	const bg = (b >> 8) & 255;
	const bb = b & 255;
	const r = Math.round(ar + (br - ar) * u);
	const g = Math.round(ag + (bg - ag) * u);
	const bch = Math.round(ab + (bb - ab) * u);
	return (r << 16) | (g << 8) | bch;
}

export function pieceColor(kind: FoodKind, doneness: number): number {
	return lerpColor(RAW[kind], COOKED[kind], doneness);
}

export function pieceFlatten(doneness: number) {
	return 1 - 0.5 * clamp(doneness, 0, 1);
}

export function dishLabel(kinds: FoodKind[]): string {
	const set = new Set(kinds);
	if (set.size === 1) {
		const only = kinds[0];
		if (only === 'egg') return '煎蛋';
		if (only === 'veg') return '炒青菜';
		if (only === 'meat') return '煎肉';
		if (only === 'dough') return '烙饼';
		if (only === 'tofu') return '煎豆腐';
		if (only === 'shrimp') return '炒虾';
	}
	if (set.has('veg') && set.has('meat') && set.size === 2) return '青菜炒肉';
	if (set.has('veg') && set.has('egg') && set.size === 2) return '青菜炒蛋';
	if (set.size >= 3) return '家常小炒';
	return '一盘小菜';
}

export function idleKitchenNotice() {
	return '把菜叶、肉片、蛋、面团、豆腐或虾拖进锅里。文火或武火，炒熟了再盛盘。';
}

export function createKitchen(): KitchenWorld {
	return {
		pan: [],
		plated: [],
		heat: 'off',
		held: null,
		notice: idleKitchenNotice(),
		paused: false,
		lowDetail: false,
		audioWanted: false,
		dockCollapsed: false,
		recovered: false,
		t: 0,
		nextId: 1
	};
}

export function pickBowl(world: KitchenWorld, kind: FoodKind) {
	if (world.paused) return;
	world.held = { source: 'bowl', kind };
	world.notice = `拿起了${FOOD_LABEL[kind]}。拖进锅里。`;
}

export function pickPanPiece(world: KitchenWorld, id: string) {
	if (world.paused) return;
	const piece = world.pan.find((item) => item.id === id);
	if (!piece) return;
	world.held = { source: 'pan', id };
	world.notice = `盛起${FOOD_LABEL[piece.kind]}。拖到盘子上，或在锅里搅拌。`;
}

function nestlePan(world: KitchenWorld, x: number, z: number) {
	let px = clamp(x, -0.5, 0.5);
	let pz = clamp(z, -0.5, 0.5);
	const crowded = world.pan.some((piece) => Math.hypot(piece.x - px, piece.z - pz) < 0.14);
	if (crowded || (world.pan.length > 0 && Math.hypot(px, pz) < 0.08)) {
		const a = world.pan.length * 2.15;
		const r = 0.22 + (world.pan.length % 3) * 0.08;
		px = clamp(Math.cos(a) * r, -0.5, 0.5);
		pz = clamp(Math.sin(a) * r, -0.5, 0.5);
	}
	return { x: px, z: pz };
}

export function dropOnPan(world: KitchenWorld, x: number, z: number): boolean {
	const held = world.held;
	if (!held) return false;
	if (held.source === 'bowl') {
		if (world.pan.length >= PAN_CAP) {
			world.notice = '锅满了';
			world.held = null;
			return false;
		}
		const at = nestlePan(world, x, z);
		world.pan.push({
			id: `k${world.nextId++}`,
			kind: held.kind,
			doneness: 0,
			x: at.x,
			z: at.z
		});
		world.held = null;
		world.notice = `${FOOD_LABEL[held.kind]}下锅了。`;
		return true;
	}
	const piece = world.pan.find((item) => item.id === held.id);
	if (!piece) {
		world.held = null;
		return false;
	}
	piece.x = clamp(x, -0.5, 0.5);
	piece.z = clamp(z, -0.5, 0.5);
	world.held = null;
	world.notice = '搅了一下。';
	return true;
}

export function stirPan(world: KitchenWorld, id: string, x: number, z: number) {
	const piece = world.pan.find((item) => item.id === id);
	if (!piece) return;
	piece.x = clamp(x, -0.62, 0.62);
	piece.z = clamp(z, -0.62, 0.62);
}

export function dropOnPlate(world: KitchenWorld, slot: number): boolean {
	const held = world.held;
	if (!held || held.source !== 'pan') {
		world.notice = '先下到锅里再盛盘。';
		world.held = null;
		return false;
	}
	const piece = world.pan.find((item) => item.id === held.id);
	if (!piece) {
		world.held = null;
		return false;
	}
	if (world.plated.length >= PLATE_CAP) {
		world.notice = '盘子满了';
		world.held = null;
		return false;
	}
	const safeSlot = Math.round(clamp(slot, 0, PLATE_CAP - 1));
	world.pan = world.pan.filter((item) => item.id !== piece.id);
	world.held = null;
	const existing = world.plated.find((dish) => dish.slot === safeSlot);
	if (existing) {
		existing.kinds.push(piece.kind);
		existing.doneness = (existing.doneness + piece.doneness) / 2;
		existing.label = dishLabel(existing.kinds);
		world.notice = `${existing.label}又多了一点。`;
		return true;
	}
	const dish: PlatedDish = {
		id: `d${world.nextId++}`,
		slot: safeSlot,
		kinds: [piece.kind],
		doneness: piece.doneness,
		label: dishLabel([piece.kind])
	};
	world.plated.push(dish);
	world.notice = `盛好了${dish.label}。`;
	return true;
}

export function setHeat(world: KitchenWorld, heat: Heat) {
	world.heat = heat;
	world.notice = heat === 'off' ? '关火了。' : heat === 'low' ? '文火。慢慢熟。' : '武火。小心糊。';
}

export function stepKitchen(world: KitchenWorld, dt: number) {
	if (world.paused || dt <= 0) return;
	world.t += dt;
	const rate = COOK_RATE[world.heat];
	if (rate === 0) return;
	for (const piece of world.pan) {
		piece.doneness = Math.min(1, piece.doneness + rate * dt);
	}
}

export function washPlates(world: KitchenWorld) {
	world.plated = [];
	world.notice = '盘子洗干净了。';
}

export function restartKitchen(world: KitchenWorld) {
	world.pan = [];
	world.held = null;
	world.heat = 'off';
	world.notice = '锅洗干净了。盘子还在。';
}

export function maxDoneness(world: KitchenWorld) {
	return world.pan.reduce((best, piece) => Math.max(best, piece.doneness), 0);
}

export function kitchenSteaming(world: KitchenWorld) {
	return world.heat !== 'off' && world.pan.some((piece) => piece.doneness > 0.15);
}

export function heldKind(world: KitchenWorld): FoodKind | null {
	const held = world.held;
	if (!held) return null;
	if (held.source === 'bowl') return held.kind;
	return world.pan.find((piece) => piece.id === held.id)?.kind ?? null;
}

export function bowlSlot(kind: FoodKind) {
	return FOOD_KINDS.indexOf(kind);
}

export function bowlWorld(kind: FoodKind) {
	const i = bowlSlot(kind);
	return { x: -1.75 + i * 0.7, y: 0.28, z: -1.18 };
}

export function plateWorld(slot: number) {
	return { x: -1.75 + slot * 0.5, y: 0.12, z: 1.12 };
}

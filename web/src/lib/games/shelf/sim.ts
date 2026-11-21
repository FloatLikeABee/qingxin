export const PROP_KINDS = [
	'globe',
	'cup',
	'moth',
	'book',
	'bottle',
	'lamp',
	'plant',
	'lute'
] as const;
export type PropKind = (typeof PROP_KINDS)[number];

export type StudyPhase = 'observe' | 'veil' | 'restore' | 'cleared';
export type StudyRoom = 'study' | 'collection';

export type RoomPlacement = {
	kind: PropKind;
	x: number;
	z: number;
	yaw: number;
	arranged: boolean;
};

export const PROP_INFO: Record<PropKind, { kind: PropKind; name: string }> = {
	globe: { kind: 'globe', name: '地球仪' },
	cup: { kind: 'cup', name: '茶杯' },
	moth: { kind: 'moth', name: '蛾标本' },
	book: { kind: 'book', name: '旧书' },
	bottle: { kind: 'bottle', name: '药水瓶' },
	lamp: { kind: 'lamp', name: '台灯' },
	plant: { kind: 'plant', name: '绿萝' },
	lute: { kind: 'lute', name: '鲁特琴' }
};

export const PUZZLES = [
	{ count: 3, movers: 2, unlock: 'globe' as PropKind },
	{ count: 4, movers: 3, unlock: 'book' as PropKind },
	{ count: 5, movers: 3, unlock: 'bottle' as PropKind },
	{ count: 6, movers: 4, unlock: 'lamp' as PropKind }
];

export type StudyWorld = {
	phase: StudyPhase;
	room: StudyRoom;
	puzzle: number;
	slots: Array<PropKind | null>;
	goal: PropKind[];
	held: PropKind | null;
	inspecting: PropKind | null;
	inspectYaw: number;
	inspectPitch: number;
	focus: number;
	unlocked: PropKind[];
	placements: RoomPlacement[];
	hintSlot: number | null;
	lastWrong: boolean;
	mistakes: number;
	veilT: number;
	scrambleTo: PropKind[] | null;
	notice: string;
	paused: boolean;
	over: boolean;
	lowDetail: boolean;
	reducedMotion: boolean;
	audioWanted: boolean;
	dockCollapsed: boolean;
	recovered: boolean;
	t: number;
};

const VEIL_MS = 520;

function scrambleKinds(goal: PropKind[], movers: number, rng: () => number): PropKind[] {
	const next = [...goal];
	const n = next.length;
	for (let i = n - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		const a = next[i]!;
		next[i] = next[j]!;
		next[j] = a;
	}
	const moved = next.filter((k, i) => k !== goal[i]).length;
	if ((moved < Math.min(movers, n) || next.every((k, i) => k === goal[i])) && n >= 2) {
		const tmp = next[0]!;
		next[0] = next[1]!;
		next[1] = tmp;
	}
	return next;
}

function unlockIntoRoom(world: StudyWorld, kind: PropKind) {
	if (!world.unlocked.includes(kind)) world.unlocked = [...world.unlocked, kind];
	if (world.placements.some((p) => p.kind === kind)) return;
	const i = world.placements.length;
	world.placements = [
		...world.placements,
		{
			kind,
			x: -1.35 + (i % 4) * 0.9,
			z: -1.05 + Math.floor(i / 4) * 0.85,
			yaw: 0,
			arranged: false
		}
	];
}

function loadPuzzle(world: StudyWorld, index: number) {
	const puzzle = Math.max(0, Math.min(PUZZLES.length - 1, index));
	const spec = PUZZLES[puzzle]!;
	const kinds = PROP_KINDS.slice(0, spec.count);
	world.puzzle = puzzle;
	world.goal = [...kinds];
	world.slots = [...kinds];
	world.held = null;
	world.inspecting = null;
	world.hintSlot = null;
	world.lastWrong = false;
	world.phase = 'observe';
	world.veilT = 0;
	world.scrambleTo = null;
	world.focus = 0;
	world.room = 'study';
	world.notice = `看清这 ${spec.count} 件东西。记住谁在哪一格。`;
}

export function createStudy(): StudyWorld {
	const world: StudyWorld = {
		phase: 'observe',
		room: 'study',
		puzzle: 0,
		slots: [],
		goal: [],
		held: null,
		inspecting: null,
		inspectYaw: 0.4,
		inspectPitch: 0.12,
		focus: 0,
		unlocked: [],
		placements: [],
		hintSlot: null,
		lastWrong: false,
		mistakes: 0,
		veilT: 0,
		scrambleTo: null,
		notice: '',
		paused: false,
		over: false,
		lowDetail: false,
		reducedMotion: false,
		audioWanted: false,
		dockCollapsed: false,
		recovered: false,
		t: 0
	};
	loadPuzzle(world, 0);
	return world;
}

export function isShelfRestored(world: StudyWorld) {
	if (world.held) return false;
	return world.goal.every((k, i) => world.slots[i] === k);
}

export function matchedCount(world: StudyWorld) {
	return world.goal.filter((k, i) => world.slots[i] === k).length;
}

function finishIfRestored(world: StudyWorld) {
	if (world.phase !== 'restore' || !isShelfRestored(world)) return;
	world.phase = 'cleared';
	world.lastWrong = false;
	world.hintSlot = null;
	const unlock = PUZZLES[world.puzzle]!.unlock;
	unlockIntoRoom(world, unlock);
	world.notice =
		world.puzzle >= PUZZLES.length - 1
			? '书房都整理好了。收藏室归你摆。'
			: `${PROP_INFO[unlock].name}进了收藏室。还可以再解下一架。`;
}

function applyScramble(world: StudyWorld) {
	const spec = PUZZLES[world.puzzle]!;
	world.slots = world.scrambleTo ?? scrambleKinds(world.goal, spec.movers, Math.random);
	world.scrambleTo = null;
	world.phase = 'restore';
	world.held = null;
	world.notice = '布帘掀开了。凭记忆放回去。放错了再拿起来就好。';
}

export function stepStudy(world: StudyWorld, dt: number) {
	if (world.paused) return;
	world.t += Math.max(0, dt);
	if (world.phase === 'veil') {
		world.veilT += dt;
		if (world.veilT >= VEIL_MS) applyScramble(world);
	}
}

export function rememberShelf(world: StudyWorld, rng: () => number = Math.random) {
	if (world.paused || world.phase !== 'observe' || world.room !== 'study') return;
	closeInspect(world);
	const spec = PUZZLES[world.puzzle]!;
	const scrambled = scrambleKinds(world.goal, spec.movers, rng);
	if (world.reducedMotion) {
		world.slots = scrambled;
		world.phase = 'restore';
		world.notice = '东西换了位置。凭记忆放回去。';
		return;
	}
	world.scrambleTo = scrambled;
	world.phase = 'veil';
	world.veilT = 0;
	world.notice = '布帘落下。';
}

export function inspectProp(world: StudyWorld, kind: PropKind) {
	if (world.paused) return;
	if (!world.slots.includes(kind) && world.held !== kind) {
		if (!world.unlocked.includes(kind)) return;
	}
	world.inspecting = kind;
	world.inspectYaw = 0.35;
	world.inspectPitch = 0.1;
	world.notice = `端详${PROP_INFO[kind].name}。方向键可以转。`;
}

export function closeInspect(world: StudyWorld) {
	world.inspecting = null;
}

export function orbitInspect(world: StudyWorld, dyaw: number, dpitch = 0) {
	if (!world.inspecting) return;
	world.inspectYaw += dyaw;
	world.inspectPitch = Math.min(0.8, Math.max(-0.4, world.inspectPitch + dpitch));
}

export function takeProp(world: StudyWorld, kind: PropKind) {
	if (world.paused || world.room !== 'study') return;
	if (world.phase !== 'restore' && world.phase !== 'cleared') return;
	closeInspect(world);
	if (world.held === kind) return;
	const at = world.slots.indexOf(kind);
	if (at < 0) return;
	const prev = world.held;
	world.held = kind;
	world.slots = world.slots.map((k, i) => (i === at ? prev : k));
	world.focus = at;
	world.notice = `拿起了${PROP_INFO[kind].name}。点一格放下。`;
}

export function putInSlot(world: StudyWorld, index: number) {
	if (world.paused || world.room !== 'study') return;
	if (world.phase !== 'restore' && world.phase !== 'cleared') return;
	if (!world.held) return;
	if (index < 0 || index >= world.slots.length) return;
	closeInspect(world);
	const prev = world.slots[index] ?? null;
	const placed = world.held;
	world.slots = world.slots.map((k, i) => (i === index ? placed : k));
	world.held = prev;
	world.focus = index;
	if (world.goal[index] !== placed) {
		world.lastWrong = true;
		world.mistakes += 1;
		world.notice = `第 ${index + 1} 格原来不是${PROP_INFO[placed].name}。再拿起来就好。`;
	} else {
		world.lastWrong = false;
		world.notice = `${PROP_INFO[placed].name}对了。`;
	}
	finishIfRestored(world);
}

export function hintShelf(world: StudyWorld) {
	if (world.phase !== 'restore') return;
	const idx = world.goal.findIndex((k, i) => world.slots[i] !== k);
	world.hintSlot = idx < 0 ? null : idx;
	if (world.hintSlot != null) {
		world.notice = `先看第 ${world.hintSlot + 1} 格。`;
	}
}

export function nextShelf(world: StudyWorld) {
	if (world.phase !== 'cleared') return;
	if (world.puzzle >= PUZZLES.length - 1) {
		world.notice = '没有更绕的架子了。去收藏室摆摆看。';
		return;
	}
	loadPuzzle(world, world.puzzle + 1);
}

export function enterRoom(world: StudyWorld) {
	closeInspect(world);
	world.held = null;
	world.room = 'collection';
	world.notice =
		world.unlocked.length === 0
			? '解开一架货架，物件才会来到这里。'
			: '收藏室。拿起物件，摆到桌上。';
}

export function enterStudy(world: StudyWorld) {
	closeInspect(world);
	world.held = null;
	world.room = 'study';
	if (world.phase === 'observe') {
		world.notice = `看清这 ${world.goal.length} 件东西。记住谁在哪一格。`;
	}
}

export function placeInRoom(world: StudyWorld, kind: PropKind, x: number, z: number, yaw: number) {
	if (world.room !== 'collection') return;
	if (!world.unlocked.includes(kind)) return;
	const next = world.placements.filter((p) => p.kind !== kind);
	next.push({
		kind,
		x: Math.min(2.2, Math.max(-2.2, x)),
		z: Math.min(2.0, Math.max(-2.0, z)),
		yaw,
		arranged: true
	});
	world.placements = next;
	world.notice = `${PROP_INFO[kind].name}放好了。`;
}

export function rotateRoom(world: StudyWorld, kind: PropKind, dyaw: number) {
	world.placements = world.placements.map((p) =>
		p.kind === kind ? { ...p, yaw: p.yaw + dyaw, arranged: true } : p
	);
}

export function setFocus(world: StudyWorld, index: number) {
	if (index < 0 || index >= world.slots.length) return;
	world.focus = index;
}

export function restartStudy(world: StudyWorld) {
	const next = createStudy();
	next.lowDetail = world.lowDetail;
	next.audioWanted = world.audioWanted;
	next.dockCollapsed = world.dockCollapsed;
	Object.assign(world, next);
}

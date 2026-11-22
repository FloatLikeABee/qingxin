export const WARNING_COPY =
	'内容警告：本游戏含写实手术画面、伤口与血液，仅供娱乐。这不是医学训练，也不能用于真实诊疗。数据与解剖均为虚构。';

export const ACK_LABEL = '我已知晓，进入手术';

export const PHASES = ['cut', 'sew'] as const;
export type WorkPhase = (typeof PHASES)[number];
export type Phase = WorkPhase | 'done';
export type RegionId = 'forearm' | 'knee' | 'tooth' | 'belly';
export type ViewId = 'warning' | 'hub' | 'field';
export type Gesture = 'path';

export type ToolId = 'scalpel' | 'needle';

export const TOOL_LABEL: Record<ToolId, string> = {
	scalpel: '刀',
	needle: '缝针'
};

export const PHASE_LABEL: Record<Phase, string> = {
	cut: '切开',
	sew: '缝合',
	done: '完成'
};

export type StepDef = {
	tool: ToolId;
	gesture: Gesture;
};

export type RegionDef = {
	id: RegionId;
	name: string;
	blurb: string;
	tools: ToolId[];
	steps: Record<WorkPhase, StepDef>;
};

const TWO_TOOLS: ToolId[] = ['scalpel', 'needle'];
const TWO_STEPS: Record<WorkPhase, StepDef> = {
	cut: { tool: 'scalpel', gesture: 'path' },
	sew: { tool: 'needle', gesture: 'path' }
};

export const REGIONS: Record<RegionId, RegionDef> = {
	forearm: {
		id: 'forearm',
		name: '前臂',
		blurb: '沿标记线切开虚构前臂，再沿同一条线缝合。不是真实术式。',
		tools: TWO_TOOLS,
		steps: TWO_STEPS
	},
	knee: {
		id: 'knee',
		name: '膝',
		blurb: '沿标记线切开虚构膝部，再缝合。不是真实术式。',
		tools: TWO_TOOLS,
		steps: TWO_STEPS
	},
	tooth: {
		id: 'tooth',
		name: '口腔',
		blurb: '沿标记的牙龈线切开，再缝合。不是拔牙教学。',
		tools: TWO_TOOLS,
		steps: TWO_STEPS
	},
	belly: {
		id: 'belly',
		name: '腹',
		blurb: '在虚构腹壁上切一条小口，再缝合。解剖为编造。',
		tools: TWO_TOOLS,
		steps: TWO_STEPS
	}
};

export const LOCKED_PARTS = [
	{ id: 'heart', name: '胸' },
	{ id: 'spine', name: '脊' },
	{ id: 'eye', name: '眼' }
] as const;

export type Pt = { x: number; y: number };

export type FieldLayout = {
	path: { x0: number; y0: number; x1: number; y1: number };
	target: Pt & { r: number };
	stones: Pt[];
};

export type OpWorld = {
	view: ViewId;
	graphicAck: boolean;
	region: RegionId | null;
	phase: Phase;
	tool: ToolId;
	bleed: number;
	flow: number;
	film: number;
	pool: number;
	stain: number;
	progress: number;
	complete: boolean;
	stars: Record<RegionId, number>;
	seed: number;
	lastSeed: number;
	hits: number;
	misses: number;
	slips: number;
	notice: string;
	paused: boolean;
	lowDetail: boolean;
	lessSpray: boolean;
	audioWanted: boolean;
	dockCollapsed: boolean;
	reducedMotion: boolean;
	recovered: boolean;
	pointerDown: boolean;
	px: number;
	py: number;
	sprayCap: number;
	spray: number;
	stoneCount: number;
	stoneIndex: number;
	heldStone: boolean;
	extracted: boolean;
	pathBins: boolean[];
	holdClock: number;
	slippedThisDown: boolean;
	elapsed: number;
	wrongNoted: boolean;
};

function clamp(n: number, a: number, b: number) {
	return Math.max(a, Math.min(b, n));
}

export function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function fieldLayout(region: RegionId, seed: number): FieldLayout {
	const r = mulberry32((seed >>> 0) + region.charCodeAt(0) * 17);
	const oy = (r() - 0.5) * 0.1;
	const ox = (r() - 0.5) * 0.06;
	const span = region === 'belly' ? 0.18 : region === 'tooth' ? 0.22 : 0.28;
	const path = { x0: 0.5 - span + ox, y0: 0.5 + oy, x1: 0.5 + span + ox, y1: 0.5 + oy };
	const target = { x: 0.5 + ox, y: 0.5 + oy, r: 0.16 };
	const stones: Pt[] = [];
	return { path, target, stones };
}

function distSeg(
	px: number,
	py: number,
	x0: number,
	y0: number,
	x1: number,
	y1: number
): { d: number; t: number } {
	const dx = x1 - x0;
	const dy = y1 - y0;
	const l2 = dx * dx + dy * dy || 1e-8;
	const t = clamp(((px - x0) * dx + (py - y0) * dy) / l2, 0, 1);
	return { d: Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy)), t };
}

function currentStep(world: OpWorld): StepDef | null {
	if (!world.region || world.phase === 'done') return null;
	return REGIONS[world.region].steps[world.phase];
}

export function legalTools(world: OpWorld): ToolId[] {
	const step = currentStep(world);
	if (!step) return [];
	return [step.tool];
}

function toolOk(world: OpWorld) {
	return legalTools(world).includes(world.tool);
}

function layoutOf(world: OpWorld): FieldLayout | null {
	if (!world.region) return null;
	return fieldLayout(world.region, world.seed);
}

function nearWork(world: OpWorld): boolean {
	const lay = layoutOf(world);
	if (!lay) return false;
	const { d } = distSeg(world.px, world.py, lay.path.x0, lay.path.y0, lay.path.x1, lay.path.y1);
	return d < 0.22;
}

function sprayCapFor(world: OpWorld) {
	if (world.reducedMotion) return 0;
	if (world.lessSpray || world.lowDetail) return 20;
	return 80;
}

function resetBins(world: OpWorld) {
	world.pathBins = Array(10).fill(false);
	world.holdClock = 0;
	world.progress = 0;
	world.wrongNoted = false;
}

function resetProcedure(world: OpWorld) {
	world.phase = 'cut';
	world.complete = false;
	world.bleed = 0;
	world.flow = 0;
	world.film = 0;
	world.pool = 0;
	world.stain = 0;
	world.extracted = false;
	world.stoneIndex = 0;
	world.stoneCount = 0;
	world.heldStone = false;
	world.hits = 0;
	world.misses = 0;
	world.slips = 0;
	world.notice = REGIONS[world.region!]?.blurb ?? '';
	world.pointerDown = false;
	world.spray = 0;
	world.tool = 'scalpel';
	resetBins(world);
}

function noteWrong(world: OpWorld) {
	if (world.wrongNoted) return;
	world.wrongNoted = true;
	world.misses += 1;
	const need = legalTools(world)[0];
	world.notice = `现在不能用${TOOL_LABEL[world.tool]}。${PHASE_LABEL[world.phase]}请用${TOOL_LABEL[need ?? 'scalpel']}。`;
}

function maybeSlip(world: OpWorld) {
	if (world.phase !== 'cut' || world.tool !== 'scalpel' || world.slippedThisDown) return;
	if (!world.pointerDown) return;
	if (nearWork(world)) return;
	const lay = layoutOf(world);
	if (!lay) return;
	const { d } = distSeg(world.px, world.py, lay.path.x0, lay.path.y0, lay.path.x1, lay.path.y1);
	if (d < 0.22) return;
	world.slippedThisDown = true;
	world.slips += 1;
	world.bleed = clamp(world.bleed + 10, 0, 100);
	world.flow = Math.max(world.flow, 20);
	world.notice = '刀滑了一下。伤口还在。';
}

function coverPath(world: OpWorld) {
	if (!toolOk(world)) {
		noteWrong(world);
		return;
	}
	const lay = layoutOf(world);
	const step = currentStep(world);
	if (!lay || !step || step.gesture !== 'path') return;
	const { d, t } = distSeg(world.px, world.py, lay.path.x0, lay.path.y0, lay.path.x1, lay.path.y1);
	if (d > 0.2) return;
	const bin = Math.min(9, Math.floor(t * 10));
	world.pathBins[bin] = true;
	if (bin > 0) world.pathBins[bin - 1] = true;
	if (bin < 9) world.pathBins[bin + 1] = true;
	const filled = world.pathBins.filter(Boolean).length / 10;
	world.progress = Math.max(world.progress, filled);
	if (world.tool === 'scalpel' && world.phase === 'cut') {
		world.flow = Math.max(world.flow, 24);
		world.bleed = clamp(world.bleed + 0.9, 0, 100);
		world.spray = Math.min(world.sprayCap, world.spray + 2);
	}
	if (world.tool === 'needle' && world.phase === 'sew') {
		world.flow = Math.max(0, world.flow - 8);
		world.bleed = Math.max(0, world.bleed - 1.2);
	}
}

function maybeAdvance(world: OpWorld) {
	if (world.phase === 'done' || world.progress < 0.85) return;
	const idx = PHASES.indexOf(world.phase as WorkPhase);
	world.hits += 1;
	world.pointerDown = false;
	if (idx < 0 || idx >= PHASES.length - 1) {
		world.phase = 'done';
		world.complete = true;
		world.flow = 0;
		world.progress = 1;
		const acc = world.hits / Math.max(1, world.hits + world.misses);
		let stars = 1;
		if (acc >= 0.5 && world.slips <= 2) stars = 2;
		if (acc >= 0.75 && world.slips === 0) stars = 3;
		if (world.region) world.stars[world.region] = Math.max(world.stars[world.region], stars);
		world.notice = '缝合完成。这是虚构娱乐，不是医疗建议。';
		return;
	}
	world.phase = PHASES[idx + 1];
	resetBins(world);
	world.notice = `进入${PHASE_LABEL[world.phase]}。请改用${TOOL_LABEL[legalTools(world)[0] ?? 'needle']}。`;
	const next = legalTools(world)[0];
	if (next) world.tool = next;
}

function applyBlood(world: OpWorld, dt: number) {
	world.sprayCap = sprayCapFor(world);
	if (world.view !== 'field') return;
	if (world.paused) return;
	if (world.phase === 'done') {
		world.flow = 0;
		world.bleed = Math.max(0, world.bleed - 55 * dt);
	} else {
		if (world.phase === 'sew') world.flow = Math.max(0, world.flow - 36 * dt);
		world.bleed = clamp(world.bleed + world.flow * dt, 0, 100);
		if (world.pointerDown && toolOk(world) && nearWork(world) && world.tool === 'needle') {
			world.flow = Math.max(0, world.flow - 22 * dt);
			world.bleed = Math.max(0, world.bleed - 18 * dt);
		}
	}
	world.stain = clamp(world.stain + world.bleed * 0.01 * dt, 0, 100);
	world.film = Math.min(1, world.bleed / 35);
	world.pool = clamp((world.bleed - 10) / 90, 0, 1);
	if (world.sprayCap === 0) world.spray = 0;
	else world.spray = Math.min(world.sprayCap, world.spray);
}

export function createOp(seed = 1): OpWorld {
	const s = seed >>> 0 || 1;
	return {
		view: 'warning',
		graphicAck: false,
		region: null,
		phase: 'cut',
		tool: 'scalpel',
		bleed: 0,
		flow: 0,
		film: 0,
		pool: 0,
		stain: 0,
		progress: 0,
		complete: false,
		stars: { forearm: 0, knee: 0, tooth: 0, belly: 0 },
		seed: s,
		lastSeed: s,
		hits: 0,
		misses: 0,
		slips: 0,
		notice: WARNING_COPY,
		paused: false,
		lowDetail: false,
		lessSpray: false,
		audioWanted: false,
		dockCollapsed: false,
		reducedMotion: false,
		recovered: false,
		pointerDown: false,
		px: 0.5,
		py: 0.5,
		sprayCap: 80,
		spray: 0,
		stoneCount: 0,
		stoneIndex: 0,
		heldStone: false,
		extracted: false,
		pathBins: Array(10).fill(false),
		holdClock: 0,
		slippedThisDown: false,
		elapsed: 0,
		wrongNoted: false
	};
}

export function ackGraphic(world: OpWorld) {
	world.graphicAck = true;
	world.view = 'hub';
	world.region = null;
	world.notice = '选择开放的解剖区域。其余部位尚未制作。';
}

export function pickRegion(world: OpWorld, id: RegionId) {
	if (!world.graphicAck) return;
	world.view = 'field';
	world.region = id;
	world.seed = world.lastSeed;
	resetProcedure(world);
}

export function leaveField(world: OpWorld) {
	world.view = 'hub';
	world.region = null;
	world.pointerDown = false;
	world.notice = '选择开放的解剖区域。其余部位尚未制作。';
}

export function replayRegion(world: OpWorld) {
	if (!world.region) return;
	resetProcedure(world);
	world.notice = '同一种子，再做一次。';
}

export function reseedRegion(world: OpWorld) {
	if (!world.region) return;
	world.lastSeed = (world.seed + 17) >>> 0 || 1;
	world.seed = world.lastSeed;
	resetProcedure(world);
	world.notice = '新的切口角度。';
}

export function setOpTool(world: OpWorld, tool: ToolId) {
	if (tool !== 'scalpel' && tool !== 'needle') return;
	if (!world.region) return;
	if (!REGIONS[world.region].tools.includes(tool)) return;
	world.tool = tool;
	world.wrongNoted = false;
}

export function pointerDown(world: OpWorld, x: number, y: number) {
	if (world.view !== 'field' || world.paused || world.complete) return;
	world.pointerDown = true;
	world.px = x;
	world.py = y;
	world.slippedThisDown = false;
	world.holdClock = 0;
	world.wrongNoted = false;
	maybeSlip(world);
	const step = currentStep(world);
	if (step?.gesture === 'path') coverPath(world);
	if (step && !toolOk(world)) noteWrong(world);
}

export function pointerMove(world: OpWorld, x: number, y: number) {
	world.px = x;
	world.py = y;
	if (world.view !== 'field' || world.paused || !world.pointerDown) return;
	maybeSlip(world);
	const step = currentStep(world);
	if (step?.gesture === 'path') coverPath(world);
}

export function pointerUp(world: OpWorld) {
	if (world.view !== 'field') {
		world.pointerDown = false;
		return;
	}
	const step = currentStep(world);
	if (world.pointerDown && step?.gesture === 'path' && world.progress >= 0.6) {
		world.progress = 1;
	}
	world.pointerDown = false;
	world.holdClock = 0;
	maybeAdvance(world);
}

export function stepOp(world: OpWorld, dt: number) {
	let left = Math.max(0, dt);
	while (left > 0) {
		const d = Math.min(0.05, left);
		left -= d;
		world.elapsed += d;
		applyBlood(world, d);
		if (world.view !== 'field' || world.paused || world.complete) continue;
		if (world.pointerDown) {
			maybeSlip(world);
			const step = currentStep(world);
			if (step && !toolOk(world)) noteWrong(world);
			else if (step?.gesture === 'path') coverPath(world);
		}
		maybeAdvance(world);
	}
}

export function advanceHold(world: OpWorld, seconds: number) {
	const steps = Math.max(1, Math.ceil(seconds / 0.05));
	for (let i = 0; i < steps; i++) stepOp(world, 0.05);
}

export function setPaused(world: OpWorld, paused: boolean) {
	world.paused = paused;
	if (paused) world.pointerDown = false;
}

export function hydrateOp(world: OpWorld, partial: Partial<OpWorld>) {
	Object.assign(world, partial);
	if (world.tool !== 'scalpel' && world.tool !== 'needle') world.tool = 'scalpel';
	world.sprayCap = sprayCapFor(world);
	if (!world.graphicAck) {
		world.view = 'warning';
		world.region = null;
	} else {
		world.view = 'hub';
		world.region = null;
		world.complete = false;
		world.phase = 'cut';
		world.tool = 'scalpel';
	}
}

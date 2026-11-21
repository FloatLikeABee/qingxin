import { afterEach, describe, expect, it } from 'vitest';
import {
	ACK_LABEL,
	PHASES,
	REGIONS,
	WARNING_COPY,
	ackGraphic,
	advanceHold,
	createOp,
	fieldLayout,
	leaveField,
	legalTools,
	pickRegion,
	pointerDown,
	pointerMove,
	pointerUp,
	replayRegion,
	reseedRegion,
	setOpTool,
	stepOp
} from './sim';

function completePath(world: ReturnType<typeof createOp>) {
	const lay = fieldLayout(world.region!, world.seed);
	pointerDown(world, lay.path.x0, lay.path.y0);
	for (let i = 1; i <= 16; i++) {
		const t = i / 16;
		pointerMove(
			world,
			lay.path.x0 + (lay.path.x1 - lay.path.x0) * t,
			lay.path.y0 + (lay.path.y1 - lay.path.y0) * t
		);
		stepOp(world, 0.05);
	}
	pointerUp(world);
	stepOp(world, 0.05);
}

function completeHold(world: ReturnType<typeof createOp>, seconds = 1) {
	const lay = fieldLayout(world.region!, world.seed);
	pointerDown(world, lay.target.x, lay.target.y);
	advanceHold(world, seconds);
	pointerUp(world);
	stepOp(world, 0.05);
}

function completePick(world: ReturnType<typeof createOp>) {
	const lay = fieldLayout(world.region!, world.seed);
	const stone = lay.stones[world.stoneIndex] ?? lay.target;
	pointerDown(world, stone.x, stone.y);
	stepOp(world, 0.3);
	pointerUp(world);
	stepOp(world, 0.05);
}

function runRegion(
	world: ReturnType<typeof createOp>,
	id: 'forearm' | 'knee' | 'tooth' | 'belly'
) {
	pickRegion(world, id);
	for (const phase of PHASES) {
		expect(world.phase).toBe(phase);
		const step = REGIONS[id].steps[phase];
		if (id === 'belly' && phase === 'operate') {
			const n = world.stoneCount;
			for (let i = 0; i < n; i++) {
				setOpTool(world, 'grasper');
				completePick(world);
				setOpTool(world, 'bag');
				completePick(world);
			}
			continue;
		}
		setOpTool(world, legalTools(world)[0]);
		if (step.gesture === 'path') completePath(world);
		else if (step.gesture === 'hold') completeHold(world);
		else completePick(world);
		if (step.dual) {
			setOpTool(world, step.dual);
			completePath(world);
		}
	}
	expect(world.phase).toBe('done');
	expect(world.complete).toBe(true);
}

describe('operation sim', () => {
	afterEach(() => {
		// keep tests isolated; worlds are local
	});

	it('starts behind the blocking warning, never on a graphic field', () => {
		const world = createOp(7);
		expect(world.view).toBe('warning');
		expect(world.graphicAck).toBe(false);
		expect(world.region).toBeNull();
		expect(WARNING_COPY).toContain('写实手术画面');
		expect(WARNING_COPY).toContain('不是医学训练');
		expect(ACK_LABEL).toBe('我已知晓，进入手术');
	});

	it('acknowledgement opens the hub, not a wound', () => {
		const world = createOp(3);
		ackGraphic(world);
		expect(world.graphicAck).toBe(true);
		expect(world.view).toBe('hub');
		expect(world.region).toBeNull();
	});

	it('ignores region picks until the warning is acknowledged', () => {
		const world = createOp(3);
		pickRegion(world, 'forearm');
		expect(world.view).toBe('warning');
		expect(world.region).toBeNull();
	});

	it('lists four playable regions and honest locked parts', () => {
		expect(Object.keys(REGIONS)).toEqual(['forearm', 'knee', 'tooth', 'belly']);
		expect(REGIONS.forearm.name).toBe('前臂');
		expect(REGIONS.knee.name).toBe('膝');
		expect(REGIONS.tooth.name).toBe('口腔');
		expect(REGIONS.belly.name).toBe('腹');
	});

	it('rejects the wrong tool with a notice and does not advance', () => {
		const world = createOp(11);
		ackGraphic(world);
		pickRegion(world, 'forearm');
		expect(world.phase).toBe('prepare');
		setOpTool(world, 'scalpel');
		completePath(world);
		expect(world.phase).toBe('prepare');
		expect(world.notice).toContain('现在不能用');
		expect(world.bleed).toBe(0);
	});

	it('forearm cut raises bleed, suction lowers it, close stops flow', () => {
		const world = createOp(21);
		ackGraphic(world);
		pickRegion(world, 'forearm');
		setOpTool(world, 'gauze');
		completeHold(world);
		expect(world.phase).toBe('expose');
		const before = world.bleed;
		setOpTool(world, 'scalpel');
		completePath(world);
		expect(world.phase).toBe('operate');
		expect(world.bleed).toBeGreaterThan(before);
		expect(world.flow).toBeGreaterThan(0);
		setOpTool(world, 'forceps');
		completePick(world);
		expect(world.phase).toBe('hemostasis');
		const peaked = world.bleed;
		setOpTool(world, 'suction');
		completeHold(world, 1.2);
		expect(world.bleed).toBeLessThan(peaked);
		expect(world.phase).toBe('close');
		setOpTool(world, 'needle');
		completePath(world);
		expect(world.phase).toBe('done');
		expect(world.flow).toBe(0);
		stepOp(world, 1);
		expect(world.bleed).toBeLessThan(8);
	});

	it('reduced motion does not zero bleed', () => {
		const world = createOp(5);
		world.reducedMotion = true;
		world.lessSpray = true;
		ackGraphic(world);
		pickRegion(world, 'knee');
		setOpTool(world, 'gauze');
		completeHold(world);
		setOpTool(world, 'scalpel');
		completePath(world);
		expect(world.bleed).toBeGreaterThan(8);
		expect(world.sprayCap).toBe(0);
	});

	it('a slip restarts the current phase, not the whole procedure', () => {
		const world = createOp(9);
		ackGraphic(world);
		pickRegion(world, 'forearm');
		setOpTool(world, 'gauze');
		completeHold(world);
		expect(world.phase).toBe('expose');
		setOpTool(world, 'scalpel');
		pointerDown(world, 0.08, 0.12);
		stepOp(world, 0.2);
		pointerUp(world);
		expect(world.phase).toBe('expose');
		expect(world.slips).toBeGreaterThan(0);
		expect(world.progress).toBe(0);
		expect(world.region).toBe('forearm');
		completePath(world);
		expect(world.phase).toBe('operate');
	});

	it('completes all four regions with natural tool gestures', () => {
		const world = createOp(42);
		ackGraphic(world);
		for (const id of ['forearm', 'knee', 'tooth', 'belly'] as const) {
			runRegion(world, id);
			expect(world.stars[id]).toBeGreaterThan(0);
			leaveField(world);
			expect(world.view).toBe('hub');
		}
	});

	it('replay uses a new seed and can recover after a mistake', () => {
		const world = createOp(4);
		ackGraphic(world);
		runRegion(world, 'tooth');
		const seed = world.seed;
		replayRegion(world);
		expect(world.complete).toBe(false);
		expect(world.phase).toBe('prepare');
		expect(world.seed).toBe(seed);
		reseedRegion(world);
		expect(world.seed).not.toBe(seed);
		expect(world.phase).toBe('prepare');
	});

	it('seed moves the incision path without leaving the central band', () => {
		const a = fieldLayout('forearm', 1);
		const b = fieldLayout('forearm', 99);
		expect(a.path.y0).not.toBe(b.path.y0);
		expect(a.target.y).toBeGreaterThan(0.38);
		expect(a.target.y).toBeLessThan(0.62);
	});
});

import { describe, expect, it } from 'vitest';
import {
	ACK_LABEL,
	PHASES,
	PHASE_LABEL,
	REGIONS,
	WARNING_COPY,
	ackGraphic,
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

function runRegion(world: ReturnType<typeof createOp>, id: 'forearm' | 'knee' | 'tooth' | 'belly') {
	pickRegion(world, id);
	expect(world.phase).toBe('cut');
	setOpTool(world, 'scalpel');
	completePath(world);
	expect(world.phase).toBe('sew');
	setOpTool(world, 'needle');
	completePath(world);
	expect(world.phase).toBe('done');
	expect(world.complete).toBe(true);
}

describe('operation sim', () => {
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

	it('PHASES is exactly cut then sew with scalpel and needle only', () => {
		expect(PHASES).toEqual(['cut', 'sew']);
		expect(PHASE_LABEL.cut).toBe('切开');
		expect(PHASE_LABEL.sew).toBe('缝合');
		for (const id of Object.keys(REGIONS) as Array<keyof typeof REGIONS>) {
			expect(REGIONS[id].tools).toEqual(['scalpel', 'needle']);
			expect(Object.keys(REGIONS[id].steps).sort()).toEqual(['cut', 'sew']);
			expect(REGIONS[id].steps.cut.tool).toBe('scalpel');
			expect(REGIONS[id].steps.sew.tool).toBe('needle');
		}
	});

	it('wrong tool is a non-blocking hint and does not advance', () => {
		const world = createOp(11);
		ackGraphic(world);
		pickRegion(world, 'forearm');
		expect(world.phase).toBe('cut');
		setOpTool(world, 'needle');
		completePath(world);
		expect(world.phase).toBe('cut');
		expect(world.progress).toBe(0);
		expect(world.notice).toMatch(/现在不能用|请用刀/);
		expect(legalTools(world)).toEqual(['scalpel']);
	});

	it('forearm cut raises bleed, sew lowers it, complete awards stars', () => {
		const world = createOp(21);
		ackGraphic(world);
		pickRegion(world, 'forearm');
		setOpTool(world, 'scalpel');
		completePath(world);
		expect(world.phase).toBe('sew');
		expect(world.bleed).toBeGreaterThan(8);
		const peaked = world.bleed;
		setOpTool(world, 'needle');
		completePath(world);
		expect(world.phase).toBe('done');
		expect(world.complete).toBe(true);
		expect(world.flow).toBe(0);
		expect(world.bleed).toBeLessThan(peaked);
		expect(world.stars.forearm).toBeGreaterThan(0);
	});

	it('reduced motion does not zero bleed', () => {
		const world = createOp(5);
		world.reducedMotion = true;
		world.lessSpray = true;
		ackGraphic(world);
		pickRegion(world, 'knee');
		setOpTool(world, 'scalpel');
		completePath(world);
		expect(world.bleed).toBeGreaterThan(8);
		expect(world.sprayCap).toBe(0);
	});

	it('a slip does not reset phase or progress', () => {
		const world = createOp(9);
		ackGraphic(world);
		pickRegion(world, 'forearm');
		setOpTool(world, 'scalpel');
		const lay = fieldLayout('forearm', world.seed);
		pointerDown(world, lay.path.x0, lay.path.y0);
		pointerMove(world, lay.path.x0 + (lay.path.x1 - lay.path.x0) * 0.4, lay.path.y0);
		stepOp(world, 0.05);
		pointerUp(world);
		const kept = world.progress;
		expect(kept).toBeGreaterThan(0.15);
		const phase = world.phase;
		pointerDown(world, 0.08, 0.12);
		stepOp(world, 0.2);
		pointerUp(world);
		expect(world.phase).toBe(phase);
		expect(world.progress).toBe(kept);
		expect(world.slips).toBeGreaterThan(0);
		expect(world.region).toBe('forearm');
	});

	it('completes all four regions with natural cut then sew paths', () => {
		const world = createOp(42);
		ackGraphic(world);
		for (const id of ['forearm', 'knee', 'tooth', 'belly'] as const) {
			runRegion(world, id);
			expect(world.stars[id]).toBeGreaterThan(0);
			leaveField(world);
			expect(world.view).toBe('hub');
		}
	});

	it('replay keeps the seed and restarts at cut', () => {
		const world = createOp(4);
		ackGraphic(world);
		runRegion(world, 'tooth');
		const seed = world.seed;
		replayRegion(world);
		expect(world.complete).toBe(false);
		expect(world.phase).toBe('cut');
		expect(world.tool).toBe('scalpel');
		expect(world.seed).toBe(seed);
		reseedRegion(world);
		expect(world.seed).not.toBe(seed);
		expect(world.phase).toBe('cut');
	});

	it('seed moves the incision path without leaving the central band', () => {
		const a = fieldLayout('forearm', 1);
		const b = fieldLayout('forearm', 99);
		expect(a.path.y0).not.toBe(b.path.y0);
		expect(a.target.y).toBeGreaterThan(0.38);
		expect(a.target.y).toBeLessThan(0.62);
	});

	it('ignores a stale third tool name', () => {
		const world = createOp(2);
		ackGraphic(world);
		pickRegion(world, 'forearm');
		setOpTool(world, 'scalpel');
		setOpTool(world, 'gauze' as never);
		expect(world.tool).toBe('scalpel');
	});
});

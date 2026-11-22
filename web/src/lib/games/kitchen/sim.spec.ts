import { describe, expect, it } from 'vitest';
import {
	BOWL_RADIUS,
	bowlWorld,
	createKitchen,
	dishLabel,
	dropOnPan,
	dropOnPlate,
	FOOD_KINDS,
	FOOD_SHAPE,
	isCompactKitchen,
	maxDoneness,
	nearestPanPiece,
	pickBowl,
	pickKitchenHit,
	pickPanPiece,
	pieceColor,
	plateWorld,
	PLATE_RADIUS,
	restartKitchen,
	setHeat,
	stepKitchen,
	stirPan,
	washPlates,
	WOK_CENTER_Z,
	WOK_RADIUS,
	yolkColor
} from './sim';

describe('kitchen sim', () => {
	it('rejects a 13th pan piece with 锅满了 and leaves the bowl', () => {
		const world = createKitchen();
		for (let i = 0; i < 12; i++) {
			pickBowl(world, 'veg');
			expect(dropOnPan(world, 0, 0)).toBe(true);
		}
		pickBowl(world, 'meat');
		expect(world.held).toEqual({ source: 'bowl', kind: 'meat' });
		expect(dropOnPan(world, 0, 0)).toBe(false);
		expect(world.pan).toHaveLength(12);
		expect(world.pan.every((piece) => piece.kind === 'veg')).toBe(true);
		expect(world.notice).toMatch(/锅满了/);
		expect(world.held).toBeNull();
	});

	it('武火 doneness rises faster than 文火; off does not cook; color follows doneness not label', () => {
		const high = createKitchen();
		const low = createKitchen();
		const off = createKitchen();
		pickBowl(high, 'egg');
		dropOnPan(high, 0, 0);
		setHeat(high, 'high');
		pickBowl(low, 'egg');
		dropOnPan(low, 0, 0);
		setHeat(low, 'low');
		pickBowl(off, 'egg');
		dropOnPan(off, 0, 0);
		setHeat(off, 'off');
		stepKitchen(high, 2000);
		stepKitchen(low, 2000);
		stepKitchen(off, 2000);
		expect(high.pan[0]!.doneness).toBeGreaterThan(low.pan[0]!.doneness);
		expect(low.pan[0]!.doneness).toBeGreaterThan(0);
		expect(off.pan[0]!.doneness).toBe(0);
		expect(maxDoneness(high)).toBe(high.pan[0]!.doneness);
		expect(pieceColor('egg', 0.9)).not.toEqual(pieceColor('egg', 0));
		expect(pieceColor('egg', 0.5)).toEqual(pieceColor('egg', 0.5));
		expect(pieceColor.length).toBe(2);
		high.paused = true;
		const pausedAt = high.pan[0]!.doneness;
		stepKitchen(high, 4000);
		expect(high.pan[0]!.doneness).toBe(pausedAt);
	});

	it('plates up to 8 dishes then 盘子满了; 洗碗 clears; restart empties pan only', () => {
		const world = createKitchen();
		for (let i = 0; i < 8; i++) {
			pickBowl(world, 'veg');
			dropOnPan(world, 0, 0);
			pickPanPiece(world, world.pan[0]!.id);
			expect(dropOnPlate(world, i)).toBe(true);
		}
		expect(world.plated).toHaveLength(8);
		expect(world.plated[0]!.label).toBe('炒青菜');
		pickBowl(world, 'egg');
		dropOnPan(world, 0, 0);
		pickPanPiece(world, world.pan[0]!.id);
		expect(dropOnPlate(world, 0)).toBe(false);
		expect(world.notice).toMatch(/盘子满了/);
		expect(world.pan).toHaveLength(1);
		expect(world.plated).toHaveLength(8);
		washPlates(world);
		expect(world.plated).toHaveLength(0);
		setHeat(world, 'high');
		world.audioWanted = true;
		world.lowDetail = true;
		restartKitchen(world);
		expect(world.pan).toHaveLength(0);
		expect(world.heat).toBe('off');
		expect(world.audioWanted).toBe(true);
		expect(world.lowDetail).toBe(true);
		expect(dishLabel(['egg'])).toBe('煎蛋');
		expect(dishLabel(['veg', 'meat'])).toBe('青菜炒肉');
		expect(dishLabel(['veg', 'meat', 'shrimp'])).toBe('家常小炒');
	});

	it('compact bowls and eight plates stay inside a reachable counter', () => {
		expect(isCompactKitchen(390)).toBe(true);
		expect(isCompactKitchen(1280)).toBe(false);
		expect(new Set(Object.values(FOOD_SHAPE)).size).toBe(6);
		for (const kind of FOOD_KINDS) {
			const pos = bowlWorld(kind, true);
			expect(Math.abs(pos.x)).toBeLessThan(1.05);
			expect(pos.z).toBeLessThan(-1.05);
			expect(pos.z).toBeGreaterThan(-2.1);
			expect(pos.z + BOWL_RADIUS).toBeLessThan(WOK_CENTER_Z - WOK_RADIUS);
		}
		const xs = Array.from({ length: 8 }, (_, slot) => plateWorld(slot, true).x);
		const zs = Array.from({ length: 8 }, (_, slot) => plateWorld(slot, true).z);
		expect(Math.min(...xs)).toBeGreaterThan(-1.05);
		expect(Math.max(...xs)).toBeLessThan(1.05);
		expect(new Set(zs.map((z) => z.toFixed(2))).size).toBe(2);
		for (const z of zs) {
			expect(z - PLATE_RADIUS).toBeGreaterThan(WOK_CENTER_Z + WOK_RADIUS);
		}
		expect(yolkColor(0.9)).not.toEqual(yolkColor(0));
		expect(pieceColor('veg', 0)).not.toEqual(pieceColor('meat', 0));
		expect(pieceColor('tofu', 0)).not.toEqual(pieceColor('shrimp', 0));
	});

	it('nearest pan piece is the closest nestled food', () => {
		const world = createKitchen();
		pickBowl(world, 'veg');
		dropOnPan(world, -0.4, 0);
		pickBowl(world, 'shrimp');
		dropOnPan(world, 0.4, 0);
		expect(nearestPanPiece(world, 0.35, 0.02)?.kind).toBe('shrimp');
		expect(nearestPanPiece(world, -0.35, 0)?.kind).toBe('veg');
	});

	it('held pan food prefers a plate hit over the wok piece', () => {
		const ranked = [{ zone: 'piece' }, { zone: 'pan' }, { zone: 'plate' }];
		expect(pickKitchenHit(ranked, 'drop-plate')?.zone).toBe('plate');
		expect(pickKitchenHit(ranked, 'pick')?.zone).toBe('piece');
		expect(pickKitchenHit([{ zone: 'bowl' }, { zone: 'pan' }], 'drop-pan')?.zone).toBe('pan');
	});

	it('stir moves a pan piece without scoring', () => {
		const world = createKitchen();
		pickBowl(world, 'tofu');
		dropOnPan(world, 0, 0);
		const id = world.pan[0]!.id;
		stirPan(world, id, 0.4, -0.3);
		expect(world.pan[0]!.x).toBeCloseTo(0.4);
		expect(world.pan[0]!.z).toBeCloseTo(-0.3);
		expect(world.pan[0]!.doneness).toBe(0);
	});
});

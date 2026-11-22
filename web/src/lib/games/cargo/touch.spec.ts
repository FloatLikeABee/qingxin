import { describe, expect, it } from 'vitest';
import {
	createHaulPointers,
	emptyHaulSteerHeld,
	haulPointerActive,
	haulPointerCancelAll,
	haulPointerDown,
	haulPointerMove,
	haulPointerUp,
	haulSteerFromHeld,
	haulSteerFromPad,
	haulSteerKeyDown,
	haulSteerKeyUp
} from './touch';

describe('cargo haul touch pointers', () => {
	it('keeps throttle and steer on separate pointer ids', () => {
		const pointers = createHaulPointers();
		haulPointerDown(pointers, 'steer', 11, -0.6);
		haulPointerDown(pointers, 'throttle', 22);
		const both = haulPointerActive(pointers);
		expect(both.steer).toBeCloseTo(-0.6);
		expect(both.throttle).toBe(1);
		expect(both.brake).toBe(0);
		haulPointerUp(pointers, 11);
		const afterSteer = haulPointerActive(pointers);
		expect(afterSteer.steer).toBe(0);
		expect(afterSteer.steerHeld).toBe(false);
		expect(afterSteer.throttle).toBe(1);
		haulPointerUp(pointers, 22);
		expect(haulPointerActive(pointers).throttle).toBe(0);
	});

	it('keeps D while A is tapped and released', () => {
		const held = emptyHaulSteerHeld();
		haulSteerKeyDown(held, 1);
		expect(haulSteerFromHeld(held)).toBe(1);
		haulSteerKeyDown(held, -1);
		expect(haulSteerFromHeld(held)).toBe(-1);
		haulSteerKeyUp(held, -1);
		expect(haulSteerFromHeld(held)).toBe(1);
		haulSteerKeyUp(held, 1);
		expect(haulSteerFromHeld(held)).toBe(0);
	});

	it('maps pad x to steer and resets on cancel', () => {
		expect(haulSteerFromPad(10, 10, 100)).toBe(-1);
		expect(haulSteerFromPad(60, 10, 100)).toBe(0);
		expect(haulSteerFromPad(110, 10, 100)).toBe(1);
		const pointers = createHaulPointers();
		haulPointerDown(pointers, 'steer', 1, 0.4);
		haulPointerDown(pointers, 'throttle', 2);
		haulPointerMove(pointers, 1, -0.2);
		expect(haulPointerActive(pointers).steer).toBeCloseTo(-0.2);
		haulPointerCancelAll(pointers);
		const idle = haulPointerActive(pointers);
		expect(idle.steer).toBe(0);
		expect(idle.throttle).toBe(0);
		expect(idle.brake).toBe(0);
	});
});

import { describe, expect, it } from 'vitest';
import {
	beginNextDay,
	closeDay,
	createWorld,
	setPaused,
	setSpeed,
	stepWorld,
	tickWorld
} from './sim';
import { DAY_TICKS, dayPhase } from './day';

describe('上班 day', () => {
	it('names arrival/morning/lunch/afternoon/closing from tick', () => {
		expect(dayPhase(0)).toBe('arrival');
		expect(dayPhase(Math.floor(DAY_TICKS * (1.5 / 9)))).toBe('morning');
		expect(dayPhase(Math.floor(DAY_TICKS * (3.2 / 9)))).toBe('lunch');
		expect(dayPhase(Math.floor(DAY_TICKS * (6 / 9)))).toBe('afternoon');
		expect(dayPhase(DAY_TICKS - 1)).toBe('closing');
	});

	it('closes exactly once at 18:00 and waits for 下一天', () => {
		const world = createWorld({ seed: 3 });
		world.tick = DAY_TICKS - 1;
		tickWorld(world);
		expect(world.dayClosed).toBe(true);
		expect(world.logs).toHaveLength(1);
		const pay = world.player.pay;
		tickWorld(world);
		tickWorld(world);
		expect(world.logs).toHaveLength(1);
		expect(world.tick).toBe(DAY_TICKS);
		expect(world.day).toBe(1);
		expect(beginNextDay(world)).toBe(true);
		expect(world.day).toBe(2);
		expect(world.tick).toBe(0);
		expect(world.dayClosed).toBe(false);
		expect(world.player.pay).toBe(pay);
	});

	it('does not roll over while paused, hidden, or already closed', () => {
		const world = createWorld({ seed: 4 });
		world.tick = DAY_TICKS - 2;
		setPaused(world, true);
		stepWorld(world, 5000);
		expect(world.dayClosed).toBe(false);
		setPaused(world, false);
		world.hidden = true;
		stepWorld(world, 5000);
		expect(world.dayClosed).toBe(false);
		world.hidden = false;
		tickWorld(world);
		tickWorld(world);
		expect(world.dayClosed).toBe(true);
		expect(closeDay(world)).toBe(false);
		expect(world.logs).toHaveLength(1);
	});

	it('speed 3x advances more ticks than 1x for the same elapsed cap', () => {
		const slow = createWorld({ seed: 5 });
		const fast = createWorld({ seed: 5 });
		setSpeed(fast, 3);
		stepWorld(slow, 250);
		stepWorld(fast, 250);
		expect(fast.tick).toBeGreaterThan(slow.tick);
	});
});

import { describe, expect, it } from 'vitest';
import { LOG_CAP, appendLog, snapshotDay, type DayLog } from './logs';
import { fillJobProgress, startPerform } from './jobs';
import { acceptTask, pickPackage, placePackage } from './tasks';
import { closeDay, createWorld } from './sim';
import { stationById } from './floors';

function emptyLog(day: number): DayLog {
	return {
		day,
		roleId: 'courier',
		closedClock: '18:00',
		payEarned: 0,
		tasks: [],
		events: [],
		unfinished: []
	};
}

describe('上班 daily logs', () => {
	it('records pay, finished work, and unfinished jobs on close', () => {
		const world = createWorld({ seed: 1 });
		const offer = world.tasks[0]!;
		acceptTask(world, offer.id);
		const inbound = stationById('inbound')!;
		world.player.x = inbound.x;
		world.player.z = inbound.z;
		startPerform(world);
		fillJobProgress(world);
		const box = world.packages[0]!;
		pickPackage(world, box.id);
		placePackage(world, box.dest);
		const pay = world.player.pay;
		closeDay(world);
		expect(world.logs).toHaveLength(1);
		expect(world.logs[0]?.payEarned).toBe(pay);
		expect(world.logs[0]?.tasks.some((row) => row.status === 'done' && row.pay === pay)).toBe(true);
		expect(closeDay(world)).toBe(false);
		expect(world.logs).toHaveLength(1);
	});

	it('keeps unfinished work in the snapshot', () => {
		const world = createWorld({ seed: 2 });
		const offer = world.tasks[0]!;
		acceptTask(world, offer.id);
		const log = snapshotDay(world);
		expect(log.unfinished[0]?.title).toBe(offer.title);
		expect(log.unfinished[0]?.stage).toBe('prepare');
	});

	it(`drops logs older than ${LOG_CAP} days`, () => {
		let logs: DayLog[] = [];
		for (let day = 1; day <= LOG_CAP + 3; day++) logs = appendLog(logs, emptyLog(day));
		expect(logs).toHaveLength(LOG_CAP);
		expect(logs[0]?.day).toBe(4);
		expect(logs.at(-1)?.day).toBe(LOG_CAP + 3);
	});
});

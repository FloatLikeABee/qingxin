import { clockLabel, DAY_TICKS } from './day';
import type { RoleId } from './roles';
import type { JobStage, Task, TaskStatus } from './tasks';

export const LOG_CAP = 14;

export interface DayLogTask {
	title: string;
	status: TaskStatus;
	ticksSpent: number;
	pay: number;
}

export interface DayLogUnfinished {
	title: string;
	stage: JobStage | 'active';
	progress: number;
}

export interface DayLog {
	day: number;
	roleId: RoleId;
	closedClock: string;
	payEarned: number;
	tasks: DayLogTask[];
	events: string[];
	unfinished: DayLogUnfinished[];
}

export interface LogWorld {
	day: number;
	tick: number;
	player: { roleId: RoleId; pay: number };
	tasks: Task[];
	dayPayStart: number;
	dayEvents: string[];
	logs: DayLog[];
}

export function snapshotDay(world: LogWorld): DayLog {
	const payEarned = Math.max(0, world.player.pay - world.dayPayStart);
	const today = world.tasks.filter((task) => task.offeredAt >= 0);
	return {
		day: world.day,
		roleId: world.player.roleId,
		closedClock: clockLabel(Math.min(world.tick, DAY_TICKS)),
		payEarned,
		tasks: today
			.filter((task) => task.status !== 'offered')
			.map((task) => ({
				title: task.title,
				status: task.status,
				ticksSpent: task.ticksSpent ?? 0,
				pay: task.payGranted ?? 0
			})),
		events: world.dayEvents.slice(-12),
		unfinished: today
			.filter((task) => task.status === 'active')
			.map((task) => ({
				title: task.title,
				stage: task.stage ?? 'active',
				progress: task.progress ?? 0
			}))
	};
}

export function appendLog(logs: DayLog[], entry: DayLog): DayLog[] {
	const withoutDup = logs.filter((item) => item.day !== entry.day);
	return [...withoutDup, entry].slice(-LOG_CAP);
}

export function noteEvent(world: { dayEvents: string[]; notice: string }, text: string) {
	if (!text) return;
	world.notice = text;
	if (world.dayEvents[world.dayEvents.length - 1] === text) return;
	world.dayEvents = [...world.dayEvents, text].slice(-24);
}

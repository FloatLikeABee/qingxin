export const MISS_GRACE_MINUTES = 60;

export interface DueReminder {
	id: string;
	time: string;
	daysOfWeek: number[];
}

export interface ShanghaiClock {
	date: string;
	weekday: number;
	minutes: number;
}

export function shanghaiClock(now: Date): ShanghaiClock {
	const local = new Date(now.getTime() + 8 * 3600_000);
	const weekday = ((local.getUTCDay() + 6) % 7) + 1;
	const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
	const date = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
	return { date, weekday, minutes };
}

export function timeToMinutes(hhmm: string): number {
	const [hour, minute] = hhmm.split(':').map(Number);
	return (hour ?? 0) * 60 + (minute ?? 0);
}

export function isDue(reminder: DueReminder, now: Date, ackedTodayIds: Iterable<string>): boolean {
	const clock = shanghaiClock(now);
	if (!reminder.daysOfWeek.includes(clock.weekday)) return false;
	const dueMin = timeToMinutes(reminder.time);
	const elapsed = clock.minutes - dueMin;
	if (elapsed < 0 || elapsed > MISS_GRACE_MINUTES) return false;
	const acked = new Set(ackedTodayIds);
	return !acked.has(reminder.id);
}

export function findDue(
	reminders: DueReminder[],
	now: Date,
	ackedTodayIds: Iterable<string>
): DueReminder | undefined {
	return reminders.find((item) => isDue(item, now, ackedTodayIds));
}

export function occurrenceAtIso(date: string, time: string, tz = 'Asia/Shanghai'): string {
	const [hour, minute] = time.split(':').map(Number);
	const offset = tz === 'UTC' || tz === 'Etc/UTC' || tz === 'Z' ? 0 : 8;
	const [year, month, day] = date.split('-').map(Number);
	const utc = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, (hour ?? 0) - offset, minute ?? 0, 0);
	return new Date(utc).toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

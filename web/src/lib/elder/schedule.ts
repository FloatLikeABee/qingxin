export const REMINDER_DISCLAIMER =
	'用药提醒不能替代闹钟或家人照看。浏览器通知可能被系统延迟或关闭，请不要只依赖本应用按时服药。';

export const MEDICAL_DISCLAIMER =
	'本模块为工具辅助与信息展示，不构成医疗建议。紧急情况请拨打 120 / 110。';

export interface ReminderScheduleInput {
	time: string;
	daysOfWeek: number[];
	scheduleCron?: string;
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function validateReminderSchedule(
	input: ReminderScheduleInput
): { ok: true; time: string; daysOfWeek: number[] } | { ok: false; reason: string } {
	if (input.scheduleCron) {
		return { ok: false, reason: 'cron' };
	}
	if (!TIME_RE.test(input.time)) {
		return { ok: false, reason: 'time' };
	}
	const days = [...new Set(input.daysOfWeek)].filter((day) => day >= 1 && day <= 7);
	if (days.length === 0) {
		return { ok: false, reason: 'days' };
	}
	return { ok: true, time: input.time, daysOfWeek: days };
}

function offsetHours(tz: string): number {
	return tz === 'UTC' || tz === 'Etc/UTC' || tz === 'Z' ? 0 : 8;
}

export function nextOccurrenceIso(
	time: string,
	daysOfWeek: number[],
	tz = 'Asia/Shanghai',
	from = new Date()
): string {
	const parsed = validateReminderSchedule({ time, daysOfWeek });
	if (!parsed.ok) {
		throw new Error('invalid reminder schedule');
	}
	const [hour, minute] = parsed.time.split(':').map(Number);
	const offset = offsetHours(tz);
	const localMs = from.getTime() + offset * 3600_000;
	const local = new Date(localMs);
	for (let add = 0; add < 8; add += 1) {
		const day = new Date(
			Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + add)
		);
		const isoWeekday = ((day.getUTCDay() + 6) % 7) + 1;
		if (!parsed.daysOfWeek.includes(isoWeekday)) continue;
		day.setUTCHours(hour ?? 0, minute ?? 0, 0, 0);
		if (day.getTime() > localMs) {
			return new Date(day.getTime() - offset * 3600_000).toISOString();
		}
	}
	throw new Error('could not compute next occurrence');
}

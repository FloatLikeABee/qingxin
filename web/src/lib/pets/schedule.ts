import { validateReminderSchedule } from '../elder/schedule';

export function validateCareSchedule(input: {
	timeLocal: string;
	daysOfWeek: number[];
}): { ok: true; timeLocal: string; daysOfWeek: number[] } | { ok: false; reason: string } {
	const parsed = validateReminderSchedule({
		time: input.timeLocal,
		daysOfWeek: input.daysOfWeek
	});
	if (!parsed.ok) return { ok: false, reason: parsed.reason };
	return { ok: true, timeLocal: parsed.time, daysOfWeek: parsed.daysOfWeek };
}

import {
	asNumber,
	asNumberList,
	asRecord,
	asString,
	omitEmpty,
	withNumericOffset
} from '../api/wire';
import { occurrenceAtIso, shanghaiClock } from './due';
import type { ElderContact, ElderReminder } from './demo';

export interface ElderReminderInput {
	title: string;
	body: string;
	kind?: 'medication' | 'general';
	time: string;
	daysOfWeek: number[];
	timezone?: string;
	voiceText?: string;
}

export interface ElderToday {
	elderUserId: string;
	reminders: ElderReminder[];
	due: { reminderId: string; occurrenceAt: string; status: string }[];
	contacts: ElderContact[];
	disclaimer: string;
	medicalDisclaimer: string;
}

export function elderReminderWrite(input: ElderReminderInput): Record<string, unknown> {
	return omitEmpty({
		title: input.title.trim(),
		body: input.body.trim(),
		kind: input.kind ?? 'medication',
		time: input.time,
		days_of_week: input.daysOfWeek,
		timezone: input.timezone ?? 'Asia/Shanghai',
		voice_text: input.voiceText?.trim() || undefined
	});
}

export function elderAckWrite(occurrenceAt: string): Record<string, unknown> {
	return { occurrence_at: withNumericOffset(occurrenceAt) };
}

export function webPushJobWrite(input: {
	runAt: string;
	title: string;
	body: string;
}): Record<string, unknown> {
	return {
		kind: 'web_push',
		run_at: withNumericOffset(input.runAt),
		payload: { title: input.title, body: input.body }
	};
}

export function todayOccurrenceAt(time: string, now = new Date(), tz = 'Asia/Shanghai'): string {
	return occurrenceAtIso(shanghaiClock(now).date, time, tz);
}

export function fromElderReminder(value: unknown): ElderReminder {
	const row = asRecord(value);
	return {
		id: asString(row.id),
		title: asString(row.title),
		body: asString(row.body),
		kind: asString(row.kind) === 'general' ? 'general' : 'medication',
		time: asString(row.time),
		daysOfWeek: asNumberList(row.days_of_week),
		voiceText: asString(row.voice_text)
	};
}

export function fromElderContact(value: unknown): ElderContact {
	const row = asRecord(value);
	return {
		id: asString(row.id),
		name: asString(row.name),
		relation: asString(row.relation),
		phone: asString(row.phone),
		isEmergency: row.is_emergency == null ? undefined : Boolean(row.is_emergency)
	};
}

export function fromElderToday(value: unknown): ElderToday {
	const row = asRecord(value);
	return {
		elderUserId: asString(row.elder_user_id),
		reminders: (Array.isArray(row.reminders) ? row.reminders : []).map(fromElderReminder),
		due: (Array.isArray(row.due) ? row.due : []).map((item) => {
			const event = asRecord(item);
			return {
				reminderId: asString(event.reminder_id),
				occurrenceAt: asString(event.occurrence_at),
				status: asString(event.status)
			};
		}),
		contacts: (Array.isArray(row.contacts) ? row.contacts : []).map(fromElderContact),
		disclaimer: asString(row.disclaimer),
		medicalDisclaimer: asString(row.medical_disclaimer)
	};
}

export function fromElderProfile(value: unknown): {
	userId: string;
	activityLogOptIn: boolean;
	timezone: string;
} {
	const row = asRecord(value);
	return {
		userId: asString(row.user_id),
		activityLogOptIn: Boolean(row.activity_log_opt_in),
		timezone: asString(row.timezone, 'Asia/Shanghai')
	};
}

export function elderProfileWrite(input: {
	activityLogOptIn?: boolean;
	timezone?: string;
}): Record<string, unknown> {
	return omitEmpty({
		activity_log_opt_in: input.activityLogOptIn,
		timezone: input.timezone
	});
}

export function fromJob(value: unknown): {
	id: string;
	kind: string;
	runAt: string;
	status: string;
	payload: Record<string, unknown>;
} {
	const row = asRecord(value);
	return {
		id: asString(row.id),
		kind: asString(row.kind),
		runAt: asString(row.run_at),
		status: asString(row.status),
		payload: asRecord(row.payload)
	};
}

export function asNum(value: unknown): number {
	return asNumber(value);
}

import {
	asNumber,
	asRecord,
	asString,
	asStringList,
	omitEmpty,
	withNumericOffset
} from '../api/wire';
import { DISCLAIMER } from './disclaimer';
import { DEFAULT_CUP_ML, DEFAULT_TARGET_ML } from './water';
import type {
	CycleLog,
	PlanLog,
	ReminderLog,
	ReportLog,
	SleepLog,
	TodaySnapshot,
	WaterLog
} from './types';

export function wellnessWaterWrite(ml: number, loggedOn: string): Record<string, unknown> {
	return omitEmpty({ ml, logged_on: loggedOn });
}

export function wellnessSleepWrite(input: {
	sleepAt: string;
	wakeAt: string;
	quality: number;
	note?: string | null;
}): Record<string, unknown> {
	return omitEmpty({
		sleep_at: withNumericOffset(input.sleepAt),
		wake_at: withNumericOffset(input.wakeAt),
		quality: input.quality,
		note: input.note?.trim() || undefined
	});
}

export function wellnessConsentWrite(cycleConsent: boolean): Record<string, unknown> {
	return { cycle_consent: cycleConsent };
}

export function wellnessCycleWrite(input: {
	startDate: string;
	endDate?: string | null;
	flowLevel?: CycleLog['flowLevel'];
	symptoms?: string | null;
}): Record<string, unknown> {
	return omitEmpty({
		start_date: input.startDate,
		end_date: input.endDate || undefined,
		flow_level: input.flowLevel || undefined,
		symptoms: input.symptoms?.trim() || undefined
	});
}

export function wellnessReportWrite(input: {
	title: string;
	reportDate: string;
	metrics: ReportLog['metrics'];
}): Record<string, unknown> {
	return {
		title: input.title.trim(),
		report_date: input.reportDate,
		metrics: input.metrics.map((metric) =>
			omitEmpty({
				name: metric.name,
				value: metric.value,
				unit: metric.unit || undefined
			})
		)
	};
}

export function wellnessPlanWrite(
	kind: PlanLog['kind'],
	startDate?: string
): Record<string, unknown> {
	return omitEmpty({ kind, start_date: startDate });
}

export function wellnessCheckinWrite(day: string): Record<string, unknown> {
	return { day };
}

export function wellnessReminderWrite(input: {
	kind: ReminderLog['kind'];
	time: string;
	daysOfWeek: number[];
	timezone?: string;
}): Record<string, unknown> {
	return omitEmpty({
		kind: input.kind,
		time_local: input.time,
		days_of_week: input.daysOfWeek,
		timezone: input.timezone ?? 'Asia/Shanghai'
	});
}

export function wellnessGoalsWrite(waterMlTarget: number): Record<string, unknown> {
	return { water_ml_target: waterMlTarget };
}

export function fromWaterLog(value: unknown): WaterLog {
	const row = asRecord(value);
	return {
		id: asString(row.id),
		loggedOn: asString(row.logged_on),
		ml: asNumber(row.ml),
		loggedAt: asString(row.logged_at)
	};
}

export function fromSleepLog(value: unknown): SleepLog {
	const row = asRecord(value);
	return {
		id: asString(row.id),
		sleepAt: asString(row.sleep_at),
		wakeAt: asString(row.wake_at),
		quality: asNumber(row.quality),
		note: row.note == null ? null : asString(row.note),
		createdAt: asString(row.created_at)
	};
}

export function fromCycleLog(value: unknown): CycleLog {
	const row = asRecord(value);
	const flow = asString(row.flow_level);
	return {
		id: asString(row.id),
		startDate: asString(row.start_date),
		endDate: row.end_date == null ? null : asString(row.end_date),
		flowLevel: flow === 'light' || flow === 'medium' || flow === 'heavy' ? flow : null,
		symptoms: row.symptoms == null ? null : asString(row.symptoms)
	};
}

export function fromReportLog(value: unknown): ReportLog {
	const row = asRecord(value);
	return {
		id: asString(row.id),
		reportDate: asString(row.report_date),
		title: asString(row.title),
		metrics: (Array.isArray(row.metrics) ? row.metrics : []).map((item) => {
			const metric = asRecord(item);
			return {
				name: asString(metric.name),
				value: asString(metric.value),
				unit: metric.unit == null ? null : asString(metric.unit)
			};
		}),
		source: asString(row.source) === 'ai_stub' ? 'ai_stub' : 'manual',
		confirmed: Boolean(row.confirmed)
	};
}

export function fromPlanLog(value: unknown): PlanLog {
	const row = asRecord(value);
	const checkins = Array.isArray(row.checkins)
		? row.checkins.map((item) => (typeof item === 'string' ? item : asString(asRecord(item).day)))
		: [];
	return {
		id: asString(row.id),
		kind: asString(row.kind) === 'sleep_21' ? 'sleep_21' : 'water_21',
		title: asString(row.title),
		targetDays: asNumber(row.target_days, 21),
		startDate: asString(row.start_date),
		progressDays: asNumber(row.progress_days, checkins.length),
		checkins
	};
}

export function fromReminderLog(value: unknown): ReminderLog {
	const row = asRecord(value);
	const kind = asString(row.kind);
	return {
		id: asString(row.id),
		kind: kind === 'sleep' || kind === 'plan' ? kind : 'water',
		time: asString(row.time ?? row.time_local),
		daysOfWeek: Array.isArray(row.days_of_week)
			? row.days_of_week.filter((item): item is number => typeof item === 'number')
			: []
	};
}

export function fromWellnessToday(value: unknown): TodaySnapshot {
	const row = asRecord(value);
	const water = asRecord(row.water);
	return {
		disclaimer: asString(row.disclaimer, DISCLAIMER),
		date: asString(row.date),
		water: {
			totalMl: asNumber(water.total_ml),
			targetMl: asNumber(water.target_ml, DEFAULT_TARGET_ML),
			cupMl: asNumber(water.cup_ml, DEFAULT_CUP_ML)
		},
		sleep: row.sleep == null ? null : fromSleepLog(row.sleep),
		cycleConsent: Boolean(row.cycle_consent)
	};
}

export function tagsOf(value: unknown): string[] {
	return asStringList(value);
}

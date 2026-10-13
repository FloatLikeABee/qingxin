import { DISCLAIMER } from './disclaimer';
import { DEFAULT_CUP_ML, DEFAULT_TARGET_ML, expandInterval } from './water';
import type {
	CycleLog,
	PlanLog,
	ReminderLog,
	ReportLog,
	SleepLog,
	TodaySnapshot,
	WaterLog
} from './types';

function nid(): string {
	return crypto.randomUUID();
}

function nowIso(): string {
	return new Date().toISOString();
}

export class MemoryWellnessStore {
	waterTargetMl = DEFAULT_TARGET_ML;
	cycleConsent = false;
	water: WaterLog[] = [];
	sleep: SleepLog[] = [];
	cycles: CycleLog[] = [];
	reports: ReportLog[] = [];
	plans: PlanLog[] = [];
	reminders: ReminderLog[] = expandInterval('08:00', '22:00', 2).map((time) => ({
		id: nid(),
		kind: 'water' as const,
		time,
		daysOfWeek: [1, 2, 3, 4, 5, 6, 7]
	}));

	today(date: string): TodaySnapshot {
		const totalMl = this.water
			.filter((row) => row.loggedOn === date)
			.reduce((sum, row) => sum + row.ml, 0);
		return {
			disclaimer: DISCLAIMER,
			date,
			water: { totalMl, targetMl: this.waterTargetMl, cupMl: DEFAULT_CUP_ML },
			sleep: this.sleep[0] ?? null,
			cycleConsent: this.cycleConsent
		};
	}

	addWater(ml = DEFAULT_CUP_ML, loggedOn: string): WaterLog {
		const row: WaterLog = {
			id: nid(),
			loggedOn,
			ml,
			loggedAt: nowIso()
		};
		this.water.unshift(row);
		return row;
	}

	addSleep(input: {
		sleepAt: string;
		wakeAt: string;
		quality: number;
		note?: string | null;
	}): SleepLog {
		const row: SleepLog = {
			id: nid(),
			sleepAt: input.sleepAt,
			wakeAt: input.wakeAt,
			quality: input.quality,
			note: input.note?.trim() || null,
			createdAt: nowIso()
		};
		this.sleep.unshift(row);
		return row;
	}

	setCycleConsent(next: boolean) {
		this.cycleConsent = next;
		if (!next) this.cycles = [];
	}

	addCycle(input: {
		startDate: string;
		endDate?: string | null;
		flowLevel?: CycleLog['flowLevel'];
		symptoms?: string | null;
	}): CycleLog {
		if (!this.cycleConsent) {
			throw new Error('cycle consent required');
		}
		const row: CycleLog = {
			id: nid(),
			startDate: input.startDate,
			endDate: input.endDate ?? null,
			flowLevel: input.flowLevel ?? null,
			symptoms: input.symptoms ?? null
		};
		this.cycles.unshift(row);
		return row;
	}

	addReport(input: {
		title: string;
		reportDate: string;
		metrics: ReportLog['metrics'];
	}): ReportLog {
		const row: ReportLog = {
			id: nid(),
			title: input.title,
			reportDate: input.reportDate,
			metrics: input.metrics,
			source: 'manual',
			confirmed: true
		};
		this.reports.unshift(row);
		return row;
	}

	createPlan(kind: PlanLog['kind']): PlanLog {
		const row: PlanLog = {
			id: nid(),
			kind,
			title: kind === 'water_21' ? '21天喝水挑战' : '21天睡眠打卡',
			targetDays: 21,
			startDate: nowIso().slice(0, 10),
			progressDays: 0,
			checkins: []
		};
		this.plans.unshift(row);
		return row;
	}

	plan(id: string): PlanLog | undefined {
		return this.plans.find((item) => item.id === id);
	}

	checkin(planId: string, day: string): void {
		const plan = this.plan(planId);
		if (!plan) throw new Error('plan not found');
		if (plan.checkins.includes(day)) return;
		plan.checkins.push(day);
		plan.progressDays = plan.checkins.length;
	}
}

let singleton: MemoryWellnessStore | undefined;

export function getWellnessStore(): MemoryWellnessStore {
	singleton ??= new MemoryWellnessStore();
	return singleton;
}

export function resetWellnessStore(next = new MemoryWellnessStore()) {
	singleton = next;
	return singleton;
}

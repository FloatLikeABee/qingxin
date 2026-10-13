export interface WaterLog {
	id: string;
	loggedOn: string;
	ml: number;
	loggedAt: string;
}

export interface SleepLog {
	id: string;
	sleepAt: string;
	wakeAt: string;
	quality: number;
	note: string | null;
	createdAt: string;
}

export interface CycleLog {
	id: string;
	startDate: string;
	endDate: string | null;
	flowLevel: 'light' | 'medium' | 'heavy' | null;
	symptoms: string | null;
}

export interface ReportMetric {
	name: string;
	value: string;
	unit?: string | null;
}

export interface ReportLog {
	id: string;
	reportDate: string;
	title: string;
	metrics: ReportMetric[];
	source: 'manual' | 'ai_stub';
	confirmed: boolean;
}

export interface PlanLog {
	id: string;
	kind: 'water_21' | 'sleep_21';
	title: string;
	targetDays: number;
	startDate: string;
	progressDays: number;
	checkins: string[];
}

export interface ReminderLog {
	id: string;
	kind: 'water' | 'sleep' | 'plan';
	time: string;
	daysOfWeek: number[];
}

export interface TodaySnapshot {
	disclaimer: string;
	date: string;
	water: { totalMl: number; targetMl: number; cupMl: number };
	sleep: SleepLog | null;
	cycleConsent: boolean;
}

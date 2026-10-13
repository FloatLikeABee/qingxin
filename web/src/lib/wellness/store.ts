import { getApi } from '../api/client';
import { enqueueSync, getRecord, openQingxinDb, putRecord } from '../offline/cache';
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

const CACHE_KEY = 'snapshot';

export class WellnessStore {
	waterTargetMl = DEFAULT_TARGET_ML;
	cycleConsent = false;
	water: WaterLog[] = [];
	sleep: SleepLog[] = [];
	cycles: CycleLog[] = [];
	reports: ReportLog[] = [];
	plans: PlanLog[] = [];
	reminders: ReminderLog[] = [];
	snapshot: TodaySnapshot | null = null;

	today(date: string): TodaySnapshot {
		const totalMl = this.water
			.filter((row) => row.loggedOn === date)
			.reduce((sum, row) => sum + row.ml, 0);
		return {
			disclaimer: this.snapshot?.disclaimer ?? DISCLAIMER,
			date,
			water: {
				totalMl,
				targetMl: this.snapshot?.water.targetMl ?? this.waterTargetMl,
				cupMl: this.snapshot?.water.cupMl ?? DEFAULT_CUP_ML
			},
			sleep: this.sleep[0] ?? this.snapshot?.sleep ?? null,
			cycleConsent: this.cycleConsent
		};
	}

	async hydrate(): Promise<void> {
		try {
			const api = getApi();
			await api.getSession();
			const [today, water, sleep, cycles, reports, plans, reminders] = await Promise.all([
				api.getWellnessToday(),
				api.listWellnessWater(),
				api.listWellnessSleep(),
				api.listWellnessCycles().catch(() => [] as CycleLog[]),
				api.listWellnessReports(),
				api.listWellnessPlans(),
				api.listWellnessReminders()
			]);
			this.snapshot = today;
			this.waterTargetMl = today.water.targetMl;
			this.cycleConsent = today.cycleConsent;
			this.water = water;
			this.sleep = sleep;
			this.cycles = cycles;
			this.reports = reports;
			this.plans = plans;
			this.reminders = reminders;
			await this.persist();
		} catch {
			await this.loadCache();
		}
	}

	async addWater(ml = DEFAULT_CUP_ML, loggedOn: string): Promise<WaterLog> {
		const pending: WaterLog = {
			id: crypto.randomUUID(),
			loggedOn,
			ml,
			loggedAt: new Date().toISOString()
		};
		this.water = [pending, ...this.water];
		try {
			const row = await getApi().addWellnessWater(ml, loggedOn);
			this.water = this.water.map((item) => (item.id === pending.id ? row : item));
			this.snapshot = await getApi()
				.getWellnessToday()
				.catch(() => this.today(loggedOn));
			await this.persist();
			return row;
		} catch (error) {
			if (typeof navigator !== 'undefined' && !navigator.onLine) {
				await this.enqueue('wellness_water_create', { ml, loggedOn });
				await this.persist();
				return pending;
			}
			this.water = this.water.filter((item) => item.id !== pending.id);
			throw error;
		}
	}

	async addSleep(input: {
		sleepAt: string;
		wakeAt: string;
		quality: number;
		note?: string | null;
	}): Promise<SleepLog> {
		const row = await getApi().addWellnessSleep({
			...input,
			note: input.note?.trim() || undefined
		});
		this.sleep = [row, ...this.sleep];
		await this.persist();
		return row;
	}

	async setCycleConsent(next: boolean): Promise<void> {
		const result = await getApi().putWellnessConsent(next);
		this.cycleConsent = result.cycleConsent;
		if (!next) this.cycles = [];
		if (this.snapshot) this.snapshot = { ...this.snapshot, cycleConsent: this.cycleConsent };
		await this.persist();
	}

	async addCycle(input: {
		startDate: string;
		endDate?: string | null;
		flowLevel?: CycleLog['flowLevel'];
		symptoms?: string | null;
	}): Promise<CycleLog> {
		if (!this.cycleConsent) {
			throw new Error('cycle consent required');
		}
		const row = await getApi().addWellnessCycle(input);
		this.cycles = [row, ...this.cycles];
		await this.persist();
		return row;
	}

	async addReport(input: {
		title: string;
		reportDate: string;
		metrics: ReportLog['metrics'];
	}): Promise<ReportLog> {
		const row = await getApi().addWellnessReport(input);
		this.reports = [row, ...this.reports];
		await this.persist();
		return row;
	}

	async createPlan(kind: PlanLog['kind']): Promise<PlanLog> {
		const row = await getApi().createWellnessPlan(kind);
		this.plans = [row, ...this.plans];
		await this.persist();
		return row;
	}

	plan(id: string): PlanLog | undefined {
		return this.plans.find((item) => item.id === id);
	}

	async checkin(planId: string, day: string): Promise<void> {
		const row = await getApi().checkinWellnessPlan(planId, day);
		this.plans = this.plans.map((item) => (item.id === planId ? row : item));
		await this.persist();
	}

	private async enqueue(type: string, payload: unknown) {
		if (typeof indexedDB === 'undefined') return;
		const db = await openQingxinDb();
		try {
			await enqueueSync(db, { type, payload });
		} finally {
			db.close();
		}
	}

	async persist() {
		if (typeof indexedDB === 'undefined') return;
		const db = await openQingxinDb();
		try {
			await putRecord(db, 'wellness', CACHE_KEY, this.snapshotState());
		} finally {
			db.close();
		}
	}

	async loadCache() {
		if (typeof indexedDB === 'undefined') return;
		const db = await openQingxinDb();
		try {
			const snap = await getRecord<ReturnType<WellnessStore['snapshotState']>>(
				db,
				'wellness',
				CACHE_KEY
			);
			if (!snap) return;
			this.water = snap.water;
			this.sleep = snap.sleep;
			this.cycles = snap.cycles;
			this.reports = snap.reports;
			this.plans = snap.plans;
			this.reminders = snap.reminders;
			this.cycleConsent = snap.cycleConsent;
			this.waterTargetMl = snap.waterTargetMl;
			this.snapshot = snap.today;
		} finally {
			db.close();
		}
	}

	snapshotState() {
		return {
			water: this.water,
			sleep: this.sleep,
			cycles: this.cycles,
			reports: this.reports,
			plans: this.plans,
			reminders: this.reminders,
			cycleConsent: this.cycleConsent,
			waterTargetMl: this.waterTargetMl,
			today: this.snapshot
		};
	}
}

export { WellnessStore as MemoryWellnessStore };

let singleton: WellnessStore | undefined;

export function getWellnessStore(): WellnessStore {
	singleton ??= new WellnessStore();
	return singleton;
}

export function resetWellnessStore(next = new WellnessStore()) {
	singleton = next;
	return singleton;
}

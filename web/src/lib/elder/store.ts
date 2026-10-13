import { getApi } from '../api/client';
import { enqueueSync, getRecord, openQingxinDb, putRecord } from '../offline/cache';
import { EMERGENCY_CONTACTS, type ElderContact, type ElderReminder } from './demo';
import { findDue, shanghaiClock } from './due';
import { todayOccurrenceAt, type ElderReminderInput, type ElderToday } from './payload';
import { MEDICAL_DISCLAIMER, REMINDER_DISCLAIMER } from './schedule';

const CACHE_KEY = 'snapshot';
const ACK_KEY = 'qingxin.elder.acks';

function readAckedByDay(): Record<string, string[]> {
	try {
		const raw = globalThis.localStorage?.getItem(ACK_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as Record<string, string[]>;
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

function writeAckedByDay(value: Record<string, string[]>) {
	try {
		globalThis.localStorage?.setItem(ACK_KEY, JSON.stringify(value));
	} catch {
		/* private mode */
	}
}

export class ElderStore {
	reminders: ElderReminder[] = [];
	contacts: ElderContact[] = [...EMERGENCY_CONTACTS];
	optInLog = false;
	timezone = 'Asia/Shanghai';
	disclaimer = REMINDER_DISCLAIMER;
	medicalDisclaimer = MEDICAL_DISCLAIMER;
	elderUserId = 'me';
	ackedByDay: Record<string, string[]> = readAckedByDay();

	ackedToday(now = new Date()): string[] {
		return this.ackedByDay[shanghaiClock(now).date] ?? [];
	}

	dueReminder(now = new Date()): ElderReminder | undefined {
		const due = findDue(this.reminders, now, this.ackedToday(now));
		return due ? this.reminders.find((item) => item.id === due.id) : undefined;
	}

	async hydrate(): Promise<ElderToday | null> {
		try {
			const api = getApi();
			await api.getSession();
			const today = await api.getElderToday();
			this.elderUserId = today.elderUserId || 'me';
			this.reminders = today.reminders;
			this.contacts = today.contacts.length ? today.contacts : [...EMERGENCY_CONTACTS];
			this.disclaimer = today.disclaimer || REMINDER_DISCLAIMER;
			this.medicalDisclaimer = today.medicalDisclaimer || MEDICAL_DISCLAIMER;
			const profile = await api.getElderProfile().catch(() => null);
			if (profile) {
				this.optInLog = profile.activityLogOptIn;
				this.timezone = profile.timezone;
			}
			await this.persist();
			return today;
		} catch {
			await this.loadCache();
			return null;
		}
	}

	async createReminder(input: ElderReminderInput): Promise<ElderReminder> {
		const row = await getApi().createElderReminder(input);
		this.reminders = [...this.reminders, row];
		await this.persist();
		return row;
	}

	async ack(id: string, occurrenceAt?: string, now = new Date()): Promise<void> {
		const date = shanghaiClock(now).date;
		const at =
			occurrenceAt ??
			todayOccurrenceAt(this.reminders.find((item) => item.id === id)?.time ?? '00:00', now);
		this.ackedByDay = {
			...this.ackedByDay,
			[date]: [...new Set([...(this.ackedByDay[date] ?? []), id])]
		};
		writeAckedByDay(this.ackedByDay);
		try {
			await getApi().ackElderReminder(id, at);
		} catch (error) {
			if (typeof navigator !== 'undefined' && !navigator.onLine) {
				await this.enqueue('elder_reminder_ack', { id, occurrenceAt: at });
				return;
			}
			throw error;
		}
	}

	async setOptIn(next: boolean): Promise<void> {
		const profile = await getApi().patchElderProfile({ activityLogOptIn: next });
		this.optInLog = profile.activityLogOptIn;
		this.timezone = profile.timezone;
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
			await putRecord(db, 'elder', CACHE_KEY, {
				reminders: this.reminders,
				contacts: this.contacts,
				optInLog: this.optInLog,
				timezone: this.timezone,
				disclaimer: this.disclaimer,
				medicalDisclaimer: this.medicalDisclaimer,
				ackedByDay: this.ackedByDay
			});
		} finally {
			db.close();
		}
	}

	async loadCache() {
		this.ackedByDay = { ...readAckedByDay(), ...this.ackedByDay };
		if (typeof indexedDB === 'undefined') return;
		const db = await openQingxinDb();
		try {
			const snap = await getRecord<{
				reminders: ElderReminder[];
				contacts: ElderContact[];
				optInLog: boolean;
				timezone: string;
				disclaimer: string;
				medicalDisclaimer: string;
				ackedByDay: Record<string, string[]>;
			}>(db, 'elder', CACHE_KEY);
			if (!snap) return;
			this.reminders = snap.reminders;
			this.contacts = snap.contacts.length ? snap.contacts : [...EMERGENCY_CONTACTS];
			this.optInLog = snap.optInLog;
			this.timezone = snap.timezone;
			this.disclaimer = snap.disclaimer;
			this.medicalDisclaimer = snap.medicalDisclaimer;
			this.ackedByDay = { ...snap.ackedByDay, ...this.ackedByDay };
		} finally {
			db.close();
		}
	}
}

let singleton: ElderStore | undefined;

export function getElderStore(): ElderStore {
	singleton ??= new ElderStore();
	return singleton;
}

export function resetElderStore(next = new ElderStore()) {
	singleton = next;
	return singleton;
}

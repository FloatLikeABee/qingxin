import { afterEach, describe, expect, it } from 'vitest';
import { MockQingxinApi } from '../api/mock';
import { resetApi } from '../api/client';
import { isDue } from './due';
import { ElderStore, resetElderStore } from './store';

async function loggedStore() {
	const api = new MockQingxinApi();
	await api.login('demo@qingxin.app', 'qingxin');
	resetApi(api);
	const store = resetElderStore(new ElderStore());
	await store.hydrate();
	return store;
}

afterEach(() => {
	resetApi();
	resetElderStore();
	try {
		globalThis.localStorage?.removeItem('qingxin.elder.acks');
	} catch {
		/* ignore */
	}
});

describe('ElderStore', () => {
	it('does not seed a demo reminder', async () => {
		const store = await loggedStore();
		expect(store.reminders).toHaveLength(0);
		expect(store.dueReminder(new Date('2026-10-12T00:05:00.000Z'))).toBeUndefined();
	});

	it('opens the dose only inside the due window and stores acks per day', async () => {
		const store = await loggedStore();
		const reminder = await store.createReminder({
			title: '降压药',
			body: '早餐后一粒',
			kind: 'medication',
			time: '08:00',
			daysOfWeek: [1, 2, 3, 4, 5],
			voiceText: '该吃降压药了'
		});
		const mondayMorning = new Date('2026-10-12T00:05:00.000Z');
		expect(isDue(reminder, mondayMorning, store.ackedToday(mondayMorning))).toBe(true);
		expect(store.dueReminder(mondayMorning)?.id).toBe(reminder.id);
		await store.ack(reminder.id, undefined, mondayMorning);
		expect(store.dueReminder(mondayMorning)).toBeUndefined();
		expect(store.ackedToday(mondayMorning)).toContain(reminder.id);
		const tuesdayMorning = new Date('2026-10-13T00:05:00.000Z');
		expect(store.ackedToday(tuesdayMorning)).not.toContain(reminder.id);
		expect(store.dueReminder(tuesdayMorning)?.id).toBe(reminder.id);
	});
});

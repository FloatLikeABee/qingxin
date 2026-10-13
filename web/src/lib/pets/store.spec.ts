import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { MockQingxinApi, resetApi } from '../api/client';
import { validateCareSchedule } from './schedule';
import { PetsStore, resetPetsStore } from './store';

afterEach(async () => {
	resetApi();
	resetPetsStore();
	await new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase('qingxin');
		request.onsuccess = () => resolve();
		request.onerror = () => resolve();
		request.onblocked = () => resolve();
	});
});

async function authedStore() {
	const api = new MockQingxinApi();
	resetApi(api);
	await api.register('Ada', 'ada-pets@qingxin.app', 'password1');
	const store = resetPetsStore();
	return store;
}

describe('PetsStore', () => {
	it('counts a feed check-in on today summary', async () => {
		const store = await authedStore();
		const pet = await store.createPet({
			name: '豆豆',
			species: 'cat',
			breed: '狸花',
			birthday: '2023-04-01',
			avatarUrl: 'https://cdn.example/doudou.png'
		});
		expect(store.pets).toHaveLength(1);
		await store.addLog(pet.id, { type: 'feed' });
		const today = store.today();
		expect(today.disclaimer).toContain('非兽医建议');
		expect(today.items[0]?.done.feed).toBe(1);
		expect(today.items[0]?.done.walk).toBe(0);
	});

	it('rejects empty weekday care reminders', () => {
		expect(validateCareSchedule({ timeLocal: '08:00', daysOfWeek: [] }).ok).toBe(false);
		expect(validateCareSchedule({ timeLocal: '08:00', daysOfWeek: [1, 2, 3] }).ok).toBe(true);
	});
});

import { describe, expect, it } from 'vitest';
import { MemoryPetsStore } from './store';
import { validateCareSchedule } from './schedule';

describe('MemoryPetsStore', () => {
	it('counts a feed check-in on today summary', () => {
		const store = new MemoryPetsStore();
		const pet = store.createPet({
			name: '豆豆',
			species: 'cat',
			breed: '狸花',
			birthday: '2023-04-01',
			avatarUrl: 'https://cdn.example/doudou.png'
		});
		store.addLog(pet.id, { type: 'feed' });
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

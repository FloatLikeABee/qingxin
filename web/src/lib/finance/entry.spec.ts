import { describe, expect, it } from 'vitest';
import { confirmEntry, createEntry, selectCategory, typeDigit } from './entry';

describe('three-step bookkeeping entry', () => {
	it('goes amount → category → confirm for a 餐饮 expense', () => {
		let entry = createEntry('expense');
		for (const key of ['2', '5', '.', '5', '0']) {
			entry = typeDigit(entry, key);
		}
		entry = selectCategory(entry, {
			id: 'fin-cat-exp-food',
			name: '餐饮',
			kind: 'expense',
			system: true
		});
		expect(entry.digits).toBe('25.50');
		const confirmed = confirmEntry(entry);
		expect(confirmed).toMatchObject({
			amountFen: 2550,
			categoryName: '餐饮',
			type: 'expense',
			step: 'done'
		});
	});
});

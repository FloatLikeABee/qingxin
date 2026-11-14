import { describe, expect, it } from 'vitest';
import { readStoreSave, STORE_SAVE_KEY, writeDayResult } from './persist';

function memory() {
	const data = new Map<string, string>();
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => {
			data.set(key, value);
		}
	};
}

describe('store save', () => {
	it('keeps the best day only', () => {
		const storage = memory();
		expect(readStoreSave(storage)).toEqual({ bestRevenue: 0, bestSatisfaction: 0 });
		writeDayResult(
			{
				revenue: 40,
				leftoverUnits: 8,
				leftoverStorage: 4,
				satisfaction: 0.5,
				cash: 90,
				happy: 2,
				unhappy: 2
			},
			storage
		);
		const best = writeDayResult(
			{
				revenue: 22,
				leftoverUnits: 3,
				leftoverStorage: 1,
				satisfaction: 0.8,
				cash: 70,
				happy: 4,
				unhappy: 1
			},
			storage
		);
		expect(best).toEqual({ bestRevenue: 40, bestSatisfaction: 0.8 });
		expect(storage.getItem(STORE_SAVE_KEY)).toContain('40');
	});
});

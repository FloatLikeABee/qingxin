import { describe, expect, it } from 'vitest';
import { PLANTS, plantById } from './plants';

describe('窗前庭园 plant catalog', () => {
	it('has at least 40 unique plants with unique names and forms', () => {
		expect(PLANTS.length).toBeGreaterThanOrEqual(40);
		const ids = PLANTS.map((plant) => plant.id);
		const names = PLANTS.map((plant) => plant.name);
		const forms = PLANTS.map((plant) => plant.form);
		expect(new Set(ids).size).toBe(ids.length);
		expect(new Set(names).size).toBe(names.length);
		expect(new Set(forms).size).toBe(forms.length);
		expect(PLANTS.every((plant) => plant.name.length >= 2)).toBe(true);
		expect(
			PLANTS.every(
				(plant) =>
					['low', 'mid', 'high'].includes(plant.water) &&
					['low', 'mid', 'high'].includes(plant.light) &&
					['low', 'mid', 'high'].includes(plant.nutrient)
			)
		).toBe(true);
		expect(plantById('tomato')?.unlockAt).toBe(0);
		expect(plantById('lettuce')?.unlockAt).toBe(0);
		expect(plantById('mint')?.unlockAt).toBe(0);
		expect(PLANTS.filter((plant) => plant.unlockAt === 0).length).toBe(3);
		expect(PLANTS.some((plant) => plant.unlockAt > 0)).toBe(true);
	});
});

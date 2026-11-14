import { describe, expect, it } from 'vitest';
import { MORPH_FAMILIES, morphKey } from './morph';
import { PLANTS, plantById } from './plants';

describe('窗前庭园 plant catalog', () => {
	it('has at least 60 unique plants with unique names and morphologies', () => {
		expect(PLANTS.length).toBeGreaterThanOrEqual(60);
		const ids = PLANTS.map((plant) => plant.id);
		const names = PLANTS.map((plant) => plant.name);
		const keys = PLANTS.map((plant) => morphKey(plant.morph));
		expect(new Set(ids).size).toBe(ids.length);
		expect(new Set(names).size).toBe(names.length);
		expect(new Set(keys).size).toBe(keys.length);
		expect(PLANTS.every((plant) => plant.name.length >= 2)).toBe(true);
		expect(
			PLANTS.every(
				(plant) =>
					['low', 'mid', 'high'].includes(plant.water) &&
					['low', 'mid', 'high'].includes(plant.light) &&
					['low', 'mid', 'high'].includes(plant.nutrient)
			)
		).toBe(true);
		for (const family of MORPH_FAMILIES) {
			expect(PLANTS.some((plant) => plant.morph.family === family)).toBe(true);
		}
		expect(plantById('tomato')?.unlockAt).toBe(0);
		expect(plantById('lettuce')?.unlockAt).toBe(0);
		expect(plantById('mint')?.unlockAt).toBe(0);
		expect(plantById('bokchoy')?.name).toBe('小白菜');
		expect(PLANTS.filter((plant) => plant.unlockAt === 0).length).toBe(3);
		expect(PLANTS.some((plant) => plant.unlockAt > 0)).toBe(true);
	});
});

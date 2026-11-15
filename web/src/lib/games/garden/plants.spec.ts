import { describe, expect, it } from 'vitest';
import { morphKey } from './morph';
import { PLANTS, plantById, remapPlantId, remapSeedBag, VEG_IDS } from './plants';

describe('窗前庭园 plant catalog', () => {
	it('has exactly ten common vegetables, all available at the start', () => {
		expect(VEG_IDS).toEqual([
			'tomato',
			'cucumber',
			'eggplant',
			'chili',
			'carrot',
			'radish',
			'cabbage',
			'lettuce',
			'spinach',
			'scallion'
		]);
		expect(PLANTS.map((plant) => plant.id)).toEqual(VEG_IDS);
		expect(new Set(PLANTS.map((plant) => plant.name)).size).toBe(10);
		expect(new Set(PLANTS.map((plant) => morphKey(plant.morph))).size).toBe(10);
		expect(PLANTS.every((plant) => plant.unlockAt === 0)).toBe(true);
		expect(PLANTS.every((plant) => plant.name.length >= 2)).toBe(true);
		expect(plantById('tomato')?.name).toBe('番茄');
		expect(plantById('scallion')?.name).toBe('小葱');
		expect(plantById('mint')).toBeUndefined();
		expect(plantById('sunflower')).toBeUndefined();
	});

	it('maps legacy ornamental and extra crops onto the ten vegetables', () => {
		expect(remapPlantId('tomato')).toBe('tomato');
		expect(remapPlantId('mint')).toBe('scallion');
		expect(remapPlantId('sunflower')).toBe('chili');
		expect(remapPlantId('fern')).toBe('lettuce');
		expect(remapPlantId('cactus')).toBe('radish');
		expect(remapPlantId('grape')).toBe('cucumber');
		expect(remapPlantId('not-a-plant')).toBe('tomato');
	});

	it('merges legacy seed bags onto vegetable ids', () => {
		expect(remapSeedBag({ mint: 2, scallion: 1, sunflower: 3, grape: 1 })).toEqual({
			scallion: 3,
			chili: 3,
			cucumber: 1
		});
	});
});

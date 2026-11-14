import { describe, expect, it } from 'vitest';
import { MORPH_FAMILIES } from './morph';
import { familyRoles, planSignature, plantMeshPlan } from './meshPlan';
import { PLANTS, plantById } from './plants';

describe('garden mesh morphology', () => {
	it('gives every species a unique ripe mesh plan', () => {
		const keys = PLANTS.map((plant) => planSignature(plantMeshPlan(plant, 'ripe')));
		expect(keys.length).toBeGreaterThanOrEqual(60);
		expect(new Set(keys).size).toBe(keys.length);
		for (const family of MORPH_FAMILIES) {
			const sample = PLANTS.find((plant) => plant.morph.family === family);
			expect(sample).toBeTruthy();
			expect(plantMeshPlan(sample!, 'ripe').length).toBeGreaterThan(3);
		}
	});

	it('renders recognizable ripe forms for demo species', () => {
		const tomato = familyRoles(plantMeshPlan(plantById('tomato')!, 'ripe'));
		expect(tomato.fruits).toBeGreaterThanOrEqual(2);
		expect(tomato.leaves).toBeGreaterThanOrEqual(4);

		const lettuce = familyRoles(plantMeshPlan(plantById('lettuce')!, 'ripe'));
		expect(lettuce.leaves).toBeGreaterThanOrEqual(6);

		const sunflower = familyRoles(plantMeshPlan(plantById('sunflower')!, 'ripe'));
		expect(sunflower.blooms).toBeGreaterThanOrEqual(4);

		const fern = familyRoles(plantMeshPlan(plantById('fern')!, 'ripe'));
		expect(fern.leaves).toBeGreaterThanOrEqual(4);

		const cactus = familyRoles(plantMeshPlan(plantById('cactus')!, 'ripe'));
		expect(cactus.leaves + cactus.stems).toBeGreaterThanOrEqual(4);

		const grape = familyRoles(plantMeshPlan(plantById('grape')!, 'ripe'));
		expect(grape.fruits).toBeGreaterThanOrEqual(3);

		const mint = plantMeshPlan(plantById('mint')!, 'sprout');
		expect(mint.some((part) => part.tint === 'leaf')).toBe(true);
		expect(plantMeshPlan(plantById('tomato')!, 'seed')).toHaveLength(1);
		expect(plantMeshPlan(plantById('tomato')!, 'wilt').every((part) => part.tint === 'wood')).toBe(
			true
		);
	});
});

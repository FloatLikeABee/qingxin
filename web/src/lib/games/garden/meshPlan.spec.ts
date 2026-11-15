import { describe, expect, it } from 'vitest';
import { familyRoles, planSignature, plantMeshPlan } from './meshPlan';
import { PLANTS, plantById } from './plants';

describe('garden mesh morphology', () => {
	it('gives every vegetable a unique ripe mesh plan', () => {
		const keys = PLANTS.map((plant) => planSignature(plantMeshPlan(plant, 'ripe')));
		expect(keys).toHaveLength(10);
		expect(new Set(keys).size).toBe(10);
		const families = new Set(PLANTS.map((plant) => plant.morph.family));
		expect(families).toEqual(new Set(['fruiting', 'vine', 'rosette', 'leafy', 'grass']));
	});

	it('renders recognizable ripe forms for the ten vegetables', () => {
		const tomato = familyRoles(plantMeshPlan(plantById('tomato')!, 'ripe'));
		expect(tomato.fruits).toBeGreaterThanOrEqual(2);
		expect(tomato.leaves).toBeGreaterThanOrEqual(4);

		const lettuce = familyRoles(plantMeshPlan(plantById('lettuce')!, 'ripe'));
		expect(lettuce.leaves).toBeGreaterThanOrEqual(6);

		const cucumber = familyRoles(plantMeshPlan(plantById('cucumber')!, 'ripe'));
		expect(cucumber.fruits).toBeGreaterThanOrEqual(1);
		expect(cucumber.leaves).toBeGreaterThanOrEqual(4);

		const chili = familyRoles(plantMeshPlan(plantById('chili')!, 'ripe'));
		expect(chili.fruits).toBeGreaterThanOrEqual(2);

		const carrot = familyRoles(plantMeshPlan(plantById('carrot')!, 'ripe'));
		expect(carrot.fruits + carrot.leaves).toBeGreaterThanOrEqual(4);

		const scallion = familyRoles(plantMeshPlan(plantById('scallion')!, 'ripe'));
		expect(scallion.stems).toBeGreaterThanOrEqual(4);

		expect(plantMeshPlan(plantById('spinach')!, 'sprout').some((part) => part.tint === 'leaf')).toBe(
			true
		);
		expect(plantMeshPlan(plantById('tomato')!, 'seed')).toHaveLength(1);
		expect(plantMeshPlan(plantById('tomato')!, 'wilt').every((part) => part.tint === 'wood')).toBe(
			true
		);
	});
});

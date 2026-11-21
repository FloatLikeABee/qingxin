import { describe, expect, it } from 'vitest';
import { ROLES, roleById, rolesByFloor } from './roles';

describe('上班 roles', () => {
	it('lists seven immediately selectable roles across five floors', () => {
		expect(ROLES.map((role) => role.id).sort()).toEqual(
			['ceo', 'courier', 'engineer', 'finance', 'manager', 'sales', 'tech'].sort()
		);
		expect(new Set(ROLES.map((role) => role.floor))).toEqual(new Set([1, 2, 3, 4, 5]));
		expect(ROLES.every((role) => role.selectable === true)).toBe(true);
	});

	it('maps each role to a unique task kind', () => {
		const kinds = ROLES.map((role) => role.kind);
		expect(new Set(kinds).size).toBe(7);
		expect(roleById('courier')?.kind).toBe('sort');
		expect(roleById('sales')?.kind).toBe('negotiate');
		expect(roleById('tech')?.kind).toBe('repair');
		expect(roleById('engineer')?.kind).toBe('ship');
		expect(roleById('finance')?.kind).toBe('audit');
		expect(roleById('manager')?.kind).toBe('allocate');
		expect(roleById('ceo')?.kind).toBe('decide');
	});

	it('covers blue, white, specialist, manager, and CEO looks', () => {
		expect(ROLES.some((role) => role.collar === 'blue')).toBe(true);
		expect(ROLES.some((role) => role.collar === 'white')).toBe(true);
		expect(ROLES.some((role) => role.collar === 'specialist-blue')).toBe(true);
		expect(ROLES.some((role) => role.collar === 'specialist-white')).toBe(true);
		expect(ROLES.some((role) => role.collar === 'manager')).toBe(true);
		expect(ROLES.some((role) => role.collar === 'ceo')).toBe(true);
		expect(
			rolesByFloor(5)
				.map((role) => role.id)
				.sort()
		).toEqual(['ceo', 'manager']);
		expect(roleById('courier')?.name).toBe('物流员');
		expect(roleById('ceo')?.name).toBe('总经理');
	});
});

import { describe, expect, it } from 'vitest';
import {
	FLOORS,
	elevatorOf,
	isWalkable,
	nearStation,
	pathfind,
	stationById,
	stationsOn
} from './floors';

describe('上班 floors', () => {
	it('names five distinct departments', () => {
		expect(FLOORS.map((floor) => floor.id)).toEqual([1, 2, 3, 4, 5]);
		expect(FLOORS.map((floor) => floor.name)).toEqual([
			'后勤与物流',
			'客户与销售',
			'产品与技术',
			'人事与财务',
			'经营管理'
		]);
	});

	it('puts a shared elevator shaft on every floor', () => {
		const first = elevatorOf(1);
		expect(first).toMatchObject({ kind: 'elevator', x: 1, z: 4 });
		for (const floor of FLOORS) {
			const elevator = elevatorOf(floor.id);
			expect(elevator.x).toBe(first.x);
			expect(elevator.z).toBe(first.z);
			expect(isWalkable(floor.id, elevator.x, elevator.z)).toBe(true);
		}
	});

	it('gives each floor unique workstations', () => {
		expect(stationById('inbound')?.floor).toBe(1);
		expect(
			stationsOn(1)
				.filter((station) => station.kind === 'bay')
				.map((s) => s.bay)
		).toEqual(['A', 'B', 'C']);
		expect(stationById('negotiate')?.floor).toBe(2);
		expect(stationById('repair')?.floor).toBe(3);
		expect(stationById('test')?.floor).toBe(3);
		expect(stationById('payroll')?.floor).toBe(4);
		expect(stationById('board')?.floor).toBe(5);
		expect(stationById('office')?.floor).toBe(5);
	});

	it('pathfinds around blocked desks and reports proximity', () => {
		const path = pathfind(1, { x: 2, z: 4 }, { x: 7, z: 2 });
		expect(path.length).toBeGreaterThan(0);
		expect(path.at(-1)).toEqual({ x: 7, z: 2 });
		expect(path.every((cell) => isWalkable(1, cell.x, cell.z))).toBe(true);
		expect(nearStation(1, 3.1, 2.2, stationById('inbound')!, 1.4)).toBe(true);
		expect(nearStation(1, 10, 8, stationById('inbound')!, 1.4)).toBe(false);
	});
});

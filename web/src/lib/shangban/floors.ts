import type { FloorId } from './roles';

export const COLS = 12;
export const ROWS = 10;
export const TILE = 1.1;
export const FLOOR_HEIGHT = 3.4;

export type StationKind =
	'elevator' | 'inbound' | 'bay' | 'desk' | 'bench' | 'board' | 'break' | 'office';

export type BayId = 'A' | 'B' | 'C';

export interface Cell {
	x: number;
	z: number;
}

export interface Station {
	id: string;
	floor: FloorId;
	kind: StationKind;
	label: string;
	x: number;
	z: number;
	block: boolean;
	bay?: BayId;
	roleIds?: string[];
}

export interface FloorDef {
	id: FloorId;
	name: string;
	color: number;
	carpet: number;
	stations: Station[];
}

function st(partial: Omit<Station, 'block'> & { block?: boolean }): Station {
	return {
		block: partial.kind !== 'elevator' && partial.kind !== 'break' && partial.kind !== 'inbound',
		...partial
	};
}

export const FLOORS: FloorDef[] = [
	{
		id: 1,
		name: '后勤与物流',
		color: 0xf97316,
		carpet: 0xd6d3d1,
		stations: [
			st({ id: 'elev-1', floor: 1, kind: 'elevator', label: '电梯', x: 1, z: 4, block: false }),
			st({
				id: 'inbound',
				floor: 1,
				kind: 'inbound',
				label: '到货口',
				x: 3,
				z: 2,
				block: false,
				roleIds: ['courier']
			}),
			st({
				id: 'bay-a',
				floor: 1,
				kind: 'bay',
				label: 'A口',
				x: 8,
				z: 2,
				bay: 'A',
				roleIds: ['courier']
			}),
			st({
				id: 'bay-b',
				floor: 1,
				kind: 'bay',
				label: 'B口',
				x: 8,
				z: 4,
				bay: 'B',
				roleIds: ['courier']
			}),
			st({
				id: 'bay-c',
				floor: 1,
				kind: 'bay',
				label: 'C口',
				x: 8,
				z: 6,
				bay: 'C',
				roleIds: ['courier']
			}),
			st({ id: 'break-1', floor: 1, kind: 'break', label: '休息椅', x: 3, z: 7, block: false })
		]
	},
	{
		id: 2,
		name: '客户与销售',
		color: 0x14b8a6,
		carpet: 0xd1fae5,
		stations: [
			st({ id: 'elev-2', floor: 2, kind: 'elevator', label: '电梯', x: 1, z: 4, block: false }),
			st({
				id: 'negotiate',
				floor: 2,
				kind: 'desk',
				label: '洽谈桌',
				x: 6,
				z: 3,
				roleIds: ['sales']
			}),
			st({
				id: 'complaint',
				floor: 2,
				kind: 'desk',
				label: '投诉台',
				x: 6,
				z: 6,
				roleIds: ['sales']
			}),
			st({ id: 'reception', floor: 2, kind: 'desk', label: '前台', x: 3, z: 3 }),
			st({ id: 'break-2', floor: 2, kind: 'break', label: '休息椅', x: 3, z: 7, block: false })
		]
	},
	{
		id: 3,
		name: '产品与技术',
		color: 0xeab308,
		carpet: 0xe2e8f0,
		stations: [
			st({ id: 'elev-3', floor: 3, kind: 'elevator', label: '电梯', x: 1, z: 4, block: false }),
			st({ id: 'repair', floor: 3, kind: 'bench', label: '维修台', x: 5, z: 3, roleIds: ['tech'] }),
			st({
				id: 'test',
				floor: 3,
				kind: 'bench',
				label: '测试台',
				x: 8,
				z: 3,
				roleIds: ['engineer']
			}),
			st({ id: 'rack', floor: 3, kind: 'bench', label: '机柜', x: 8, z: 6 }),
			st({ id: 'break-3', floor: 3, kind: 'break', label: '休息椅', x: 3, z: 7, block: false })
		]
	},
	{
		id: 4,
		name: '人事与财务',
		color: 0x60a5fa,
		carpet: 0xe0f2fe,
		stations: [
			st({ id: 'elev-4', floor: 4, kind: 'elevator', label: '电梯', x: 1, z: 4, block: false }),
			st({
				id: 'payroll',
				floor: 4,
				kind: 'desk',
				label: '薪酬桌',
				x: 5,
				z: 3,
				roleIds: ['finance']
			}),
			st({
				id: 'claims',
				floor: 4,
				kind: 'desk',
				label: '报销盘',
				x: 8,
				z: 3,
				roleIds: ['finance']
			}),
			st({ id: 'interview', floor: 4, kind: 'desk', label: '面谈椅', x: 5, z: 6 }),
			st({ id: 'break-4', floor: 4, kind: 'break', label: '休息椅', x: 3, z: 7, block: false })
		]
	},
	{
		id: 5,
		name: '经营管理',
		color: 0x1d4ed8,
		carpet: 0xfef3c7,
		stations: [
			st({ id: 'elev-5', floor: 5, kind: 'elevator', label: '电梯', x: 1, z: 4, block: false }),
			st({
				id: 'board',
				floor: 5,
				kind: 'board',
				label: '编制板',
				x: 5,
				z: 3,
				roleIds: ['manager']
			}),
			st({
				id: 'budget',
				floor: 5,
				kind: 'board',
				label: '预算板',
				x: 8,
				z: 3,
				roleIds: ['manager']
			}),
			st({
				id: 'office',
				floor: 5,
				kind: 'office',
				label: '总经理室',
				x: 8,
				z: 6,
				roleIds: ['ceo']
			}),
			st({ id: 'break-5', floor: 5, kind: 'break', label: '休息椅', x: 3, z: 7, block: false })
		]
	}
];

const blocked = new Map<FloorId, Set<string>>();

function key(x: number, z: number) {
	return `${x},${z}`;
}

for (const floor of FLOORS) {
	const set = new Set<string>();
	for (let x = 0; x < COLS; x++) {
		set.add(key(x, 0));
		set.add(key(x, ROWS - 1));
	}
	for (let z = 0; z < ROWS; z++) {
		set.add(key(0, z));
		set.add(key(COLS - 1, z));
	}
	for (const station of floor.stations) {
		if (station.block) set.add(key(station.x, station.z));
	}
	blocked.set(floor.id, set);
}

export function floorById(id: FloorId): FloorDef {
	const found = FLOORS.find((floor) => floor.id === id);
	if (!found) throw new Error('missing floor');
	return found;
}

export function stationsOn(floor: FloorId): Station[] {
	return floorById(floor).stations;
}

export function stationById(id: string): Station | undefined {
	for (const floor of FLOORS) {
		const found = floor.stations.find((station) => station.id === id);
		if (found) return found;
	}
	return undefined;
}

export function elevatorOf(floor: FloorId): Station {
	const found = stationsOn(floor).find((station) => station.kind === 'elevator');
	if (!found) throw new Error('missing elevator');
	return found;
}

export function inBounds(x: number, z: number): boolean {
	return x >= 0 && z >= 0 && x < COLS && z < ROWS;
}

export function isWalkable(floor: FloorId, x: number, z: number): boolean {
	return inBounds(x, z) && !blocked.get(floor)?.has(key(x, z));
}

export function standFor(station: Station): Cell {
	const candidates: Cell[] = [
		{ x: station.x, z: station.z + 1 },
		{ x: station.x + 1, z: station.z },
		{ x: station.x - 1, z: station.z },
		{ x: station.x, z: station.z - 1 }
	];
	return (
		candidates.find((cell) => isWalkable(station.floor, cell.x, cell.z)) ?? {
			x: station.x,
			z: station.z + 1
		}
	);
}

export function nearStation(
	floor: FloorId,
	x: number,
	z: number,
	station: Station,
	radius: number
): boolean {
	if (floor !== station.floor) return false;
	const dx = x - station.x;
	const dz = z - station.z;
	return dx * dx + dz * dz <= radius * radius;
}

export function pathfind(floor: FloorId, from: Cell, to: Cell): Cell[] {
	if (from.x === to.x && from.z === to.z) return [];
	const start = key(from.x, from.z);
	const goal = key(to.x, to.z);
	const seen = new Set<string>([start]);
	const queue: { cell: Cell; path: Cell[] }[] = [{ cell: from, path: [] }];
	const deltas = [
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1]
	];
	while (queue.length > 0) {
		const current = queue.shift();
		if (!current) break;
		for (const [dx, dz] of deltas) {
			const next = { x: current.cell.x + dx, z: current.cell.z + dz };
			const id = key(next.x, next.z);
			if (seen.has(id)) continue;
			if (!(next.x === to.x && next.z === to.z) && !isWalkable(floor, next.x, next.z)) continue;
			if (!inBounds(next.x, next.z)) continue;
			const path = [...current.path, next];
			if (id === goal) return path;
			seen.add(id);
			queue.push({ cell: next, path });
		}
	}
	return [];
}

export function worldX(x: number): number {
	return (x - (COLS - 1) / 2) * TILE;
}

export function worldZ(z: number): number {
	return (z - (ROWS - 1) / 2) * TILE;
}

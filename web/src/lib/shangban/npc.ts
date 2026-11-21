import { dayPhase } from './day';
import { elevatorOf, pathfind, stationsOn, standFor, type Station } from './floors';
import type { FloorId } from './roles';

export type NpcActivity =
	'type' | 'deliver' | 'repair' | 'meet' | 'chat' | 'coffee' | 'elevator' | 'idle';

export interface StaffNpc {
	id: number;
	floor: FloorId;
	x: number;
	z: number;
	homeX: number;
	homeZ: number;
	phase: 'work' | 'break' | 'walk';
	activity: NpcActivity;
	wait: number;
	path: { x: number; z: number }[];
}

export interface StaffWorld {
	tick: number;
	rng: () => number;
	npcs: StaffNpc[];
}

function walkTo(npc: StaffNpc, station: Station, activity: NpcActivity) {
	const stand = standFor(station);
	if (
		station.floor === npc.floor &&
		Math.round(npc.x) === stand.x &&
		Math.round(npc.z) === stand.z
	) {
		npc.activity = activity;
		npc.phase = activity === 'coffee' ? 'break' : 'work';
		npc.wait = 14;
		npc.path = [];
		return;
	}
	if (station.floor !== npc.floor) {
		const shaft = elevatorOf(npc.floor);
		npc.path = pathfind(
			npc.floor,
			{ x: Math.round(npc.x), z: Math.round(npc.z) },
			{ x: shaft.x, z: shaft.z }
		);
		npc.activity = 'elevator';
		npc.phase = 'walk';
		npc.wait = 0;
		return;
	}
	npc.path = pathfind(
		npc.floor,
		{ x: Math.round(npc.x), z: Math.round(npc.z) },
		{ x: stand.x, z: stand.z }
	);
	npc.activity = activity;
	npc.phase = 'walk';
}

function pickStation(npc: StaffNpc, kinds: Station['kind'][]): Station | undefined {
	const spots = stationsOn(npc.floor).filter((station) => kinds.includes(station.kind));
	return spots[npc.id % Math.max(1, spots.length)];
}

export function chooseStaffActivity(npc: StaffNpc, tick: number, rng: () => number): NpcActivity {
	const phase = dayPhase(tick);
	if (phase === 'lunch') return 'coffee';
	if (phase === 'closing' || phase === 'arrival') return rng() < 0.5 ? 'elevator' : 'chat';
	if (npc.floor === 1) return rng() < 0.55 ? 'deliver' : 'type';
	if (npc.floor === 3) return rng() < 0.5 ? 'repair' : 'type';
	if (npc.floor === 2 || npc.floor === 4)
		return rng() < 0.45 ? 'meet' : rng() < 0.5 ? 'chat' : 'type';
	return rng() < 0.4 ? 'meet' : 'type';
}

export function tickStaff(world: StaffWorld) {
	for (const npc of world.npcs) {
		if (npc.wait > 0) {
			npc.wait -= 1;
			continue;
		}
		if (npc.path.length > 0) {
			const step = npc.path.shift();
			if (!step) continue;
			const dx = Math.abs(step.x - Math.round(npc.x));
			const dz = Math.abs(step.z - Math.round(npc.z));
			if (dx + dz > 2) {
				npc.path = [];
				continue;
			}
			npc.x = step.x;
			npc.z = step.z;
			npc.phase = 'walk';
			if (npc.path.length === 0) {
				npc.phase = npc.activity === 'coffee' ? 'break' : 'work';
				npc.wait = 14 + Math.floor(world.rng() * 16);
			}
			continue;
		}
		const next = chooseStaffActivity(npc, world.tick, world.rng);
		if (next === 'coffee') {
			const br = pickStation(npc, ['break']);
			if (br) walkTo(npc, br, 'coffee');
			else npc.wait = 10;
			continue;
		}
		if (next === 'elevator') {
			walkTo(npc, elevatorOf(npc.floor), 'elevator');
			npc.wait = 0;
			continue;
		}
		if (next === 'deliver') {
			const bay = pickStation(npc, ['inbound', 'bay']);
			if (bay) walkTo(npc, bay, 'deliver');
			else npc.wait = 8;
			continue;
		}
		if (next === 'repair') {
			const bench = pickStation(npc, ['bench']);
			if (bench) walkTo(npc, bench, 'repair');
			else npc.wait = 8;
			continue;
		}
		if (next === 'meet') {
			const desk = pickStation(npc, ['desk', 'board', 'office']);
			if (desk) walkTo(npc, desk, 'meet');
			else npc.wait = 8;
			continue;
		}
		if (next === 'chat') {
			const desk = pickStation(npc, ['desk', 'break']);
			if (desk) walkTo(npc, desk, 'chat');
			else npc.wait = 8;
			continue;
		}
		const homeDesk = pickStation(npc, ['desk', 'bench', 'board', 'office']);
		if (homeDesk) walkTo(npc, homeDesk, 'type');
		else {
			npc.activity = 'idle';
			npc.wait = 12;
		}
	}
}

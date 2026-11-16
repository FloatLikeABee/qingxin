import { elevatorOf, isWalkable, nearStation, pathfind, stationById, stationsOn } from './floors';
import type { World } from './sim';
import { pickPackage, placePackage, type BayId } from './tasks';

export function inElevatorZone(world: World): boolean {
	const shaft = elevatorOf(world.player.floor);
	return nearStation(world.player.floor, world.player.x, world.player.z, shaft, 1.5);
}

export function tryMove(
	world: World,
	dx: number,
	dz: number,
	speed = 0.18,
	fromPath = false
): boolean {
	if (world.paused || world.hidden) return false;
	if (world.player.elevatorTo != null) return false;
	if (world.player.breakUntil > world.tick) return false;
	if (dx === 0 && dz === 0) return false;
	if (!fromPath) world.player.path = [];
	const nx = world.player.x + dx * speed;
	const nz = world.player.z + dz * speed;
	const cx = Math.round(nx);
	const cz = Math.round(nz);
	if (!isWalkable(world.player.floor, cx, cz)) return false;
	world.player.x = nx;
	world.player.z = nz;
	world.player.facing = Math.atan2(dx, dz);
	return true;
}

export function interact(world: World): boolean {
	if (world.paused || world.player.elevatorTo != null) return false;
	if (world.player.breakUntil > world.tick) return false;
	const floor = world.player.floor;
	if (world.player.carrying) {
		const bays = stationsOn(floor).filter((station) => station.kind === 'bay');
		for (const bay of bays) {
			if (nearStation(floor, world.player.x, world.player.z, bay, 1.6) && bay.bay) {
				return placePackage(world, bay.bay as BayId);
			}
		}
	}
	const inbound = stationById('inbound');
	if (inbound && nearStation(floor, world.player.x, world.player.z, inbound, 1.6)) {
		const next = world.packages.find((box) => !box.held);
		if (next) return pickPackage(world, next.id);
	}
	world.notice = '走近工位再动手。';
	return false;
}

export function setDestination(world: World, x: number, z: number) {
	if (world.player.elevatorTo != null || world.player.breakUntil > world.tick) return;
	world.player.path = pathfind(
		world.player.floor,
		{ x: Math.round(world.player.x), z: Math.round(world.player.z) },
		{ x: Math.round(x), z: Math.round(z) }
	);
}

export function followPath(world: World): boolean {
	const step = world.player.path[0];
	if (!step) return false;
	const dx = step.x - world.player.x;
	const dz = step.z - world.player.z;
	if (Math.abs(dx) + Math.abs(dz) < 0.28) {
		world.player.x = step.x;
		world.player.z = step.z;
		world.player.path.shift();
		return true;
	}
	if (Math.abs(dx) >= Math.abs(dz)) {
		const movedX = tryMove(world, Math.sign(dx), 0, 0.2, true);
		if (movedX) return true;
	}
	if (dz !== 0) {
		const movedZ = tryMove(world, 0, Math.sign(dz), 0.2, true);
		if (movedZ) return true;
	}
	if (Math.abs(dx) < Math.abs(dz) && dx !== 0) {
		const movedX = tryMove(world, Math.sign(dx), 0, 0.2, true);
		if (movedX) return true;
	}
	if (isWalkable(world.player.floor, step.x, step.z)) {
		world.player.x = step.x;
		world.player.z = step.z;
		world.player.path.shift();
		return true;
	}
	world.player.path.shift();
	return world.player.path.length > 0;
}

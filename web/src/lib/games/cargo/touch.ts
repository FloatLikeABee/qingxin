export type HaulPointerKind = 'steer' | 'throttle' | 'brake';

export type HaulSteerHeld = { left: boolean; right: boolean; last: -1 | 1 | 0 };

export function emptyHaulSteerHeld(): HaulSteerHeld {
	return { left: false, right: false, last: 0 };
}

export function haulSteerFromHeld(held: HaulSteerHeld) {
	if (held.left && held.right) return held.last || 0;
	if (held.right) return 1;
	if (held.left) return -1;
	return 0;
}

export function haulSteerKeyDown(held: HaulSteerHeld, value: number) {
	if (value < 0) held.left = true;
	if (value > 0) held.right = true;
	held.last = value < 0 ? -1 : 1;
}

export function haulSteerKeyUp(held: HaulSteerHeld, value: number) {
	if (value < 0) held.left = false;
	if (value > 0) held.right = false;
	if (held.left && !held.right) held.last = -1;
	else if (held.right && !held.left) held.last = 1;
	else if (!held.left && !held.right) held.last = 0;
}

export type HaulPointers = {
	steer: Map<number, number>;
	throttle: Set<number>;
	brake: Set<number>;
};

export function createHaulPointers(): HaulPointers {
	return { steer: new Map(), throttle: new Set(), brake: new Set() };
}

export function haulSteerFromPad(clientX: number, left: number, width: number) {
	const nx = (clientX - left) / Math.max(1, width);
	return Math.max(-1, Math.min(1, nx * 2 - 1));
}

export function haulPointerDown(
	pointers: HaulPointers,
	kind: HaulPointerKind,
	id: number,
	steer = 0
) {
	if (kind === 'steer') pointers.steer.set(id, Math.max(-1, Math.min(1, steer)));
	if (kind === 'throttle') pointers.throttle.add(id);
	if (kind === 'brake') pointers.brake.add(id);
}

export function haulPointerMove(pointers: HaulPointers, id: number, steer: number) {
	if (!pointers.steer.has(id)) return;
	pointers.steer.set(id, Math.max(-1, Math.min(1, steer)));
}

export function haulPointerUp(pointers: HaulPointers, id: number) {
	pointers.steer.delete(id);
	pointers.throttle.delete(id);
	pointers.brake.delete(id);
}

export function haulPointerCancelAll(pointers: HaulPointers) {
	pointers.steer.clear();
	pointers.throttle.clear();
	pointers.brake.clear();
}

export function haulPointerActive(pointers: HaulPointers) {
	let steer = 0;
	for (const value of pointers.steer.values()) steer = value;
	return {
		steer,
		throttle: pointers.throttle.size > 0 ? 1 : 0,
		brake: pointers.brake.size > 0 ? 1 : 0,
		steerHeld: pointers.steer.size > 0,
		throttleHeld: pointers.throttle.size > 0,
		brakeHeld: pointers.brake.size > 0
	};
}

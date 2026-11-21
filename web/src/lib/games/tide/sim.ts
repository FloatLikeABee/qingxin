export const STAR_COUNT = 6;
export const COLLECT_RADIUS = 1.15;
export const CORAL_THRESHOLDS = [1, 3, 6] as const;
export const SWELL_UP_PER_MS = 0.35 / 1000;
export const SWELL_DOWN_PER_MS = 0.22 / 1000;
export const PULSE_DECAY_PER_MS = 0.9 / 1000;
export const STEER_SPEED = 0.00155;
export const DRIFT_SPEED = 0.00038;
export const NUDGE = 0.22;

export type CreatureKind = 'jelly' | 'lantern' | 'manta';

export interface Creature {
	id: number;
	kind: CreatureKind;
	x: number;
	z: number;
	heading: number;
	speed: number;
}

export interface Starlight {
	id: number;
	x: number;
	z: number;
	collected: boolean;
}

export interface CoralPatch {
	id: number;
	x: number;
	z: number;
	unlocked: boolean;
	growth: number;
}

export interface TideWorld {
	swell: number;
	pulse: number;
	holding: boolean;
	paused: boolean;
	over: boolean;
	selected: number;
	steerX: number | null;
	steerZ: number | null;
	creatures: Creature[];
	stars: Starlight[];
	coral: CoralPatch[];
	collected: number;
	notice: string;
	recovered: boolean;
	lowDetail: boolean;
	audioWanted: boolean;
	dockCollapsed: boolean;
	paceHint: number;
	time: number;
	keys: { up: boolean; down: boolean; left: boolean; right: boolean };
}

function clamp(n: number, min: number, max: number) {
	return Math.min(max, Math.max(min, n));
}

export function createTide(): TideWorld {
	const creatures: Creature[] = [
		{ id: 1, kind: 'jelly', x: 0.12, z: 2.15, heading: -0.2, speed: 0.9 },
		{ id: 2, kind: 'lantern', x: -3.4, z: -1.1, heading: 0.8, speed: 0.7 },
		{ id: 3, kind: 'manta', x: 3.8, z: -2.6, heading: -1.1, speed: 1.05 }
	];
	const stars: Starlight[] = [
		{ id: 0, x: 0.08, z: 0.72, collected: false },
		{ id: 1, x: -2.4, z: 1.1, collected: false },
		{ id: 2, x: 2.7, z: 0.4, collected: false },
		{ id: 3, x: -1.6, z: -2.2, collected: false },
		{ id: 4, x: 1.9, z: -3.1, collected: false },
		{ id: 5, x: 0.3, z: -4.4, collected: false }
	];
	const coral: CoralPatch[] = [
		{ id: 0, x: -1.8, z: -0.4, unlocked: false, growth: 0 },
		{ id: 1, x: 2.1, z: -1.6, unlocked: false, growth: 0 },
		{ id: 2, x: 0.2, z: -3.4, unlocked: false, growth: 0 }
	];
	return {
		swell: 0.08,
		pulse: 0,
		holding: false,
		paused: false,
		over: false,
		selected: 1,
		steerX: null,
		steerZ: null,
		creatures,
		stars,
		coral,
		collected: 0,
		notice: '按住随潮升起，松开送出波纹。不必憋气。',
		recovered: false,
		lowDetail: false,
		audioWanted: false,
		dockCollapsed: false,
		paceHint: 0,
		time: 0,
		keys: { up: false, down: false, left: false, right: false }
	};
}

export function holdTide(world: TideWorld, holding: boolean) {
	if (world.holding && !holding) {
		world.pulse = Math.max(world.pulse, 0.45 + world.swell * 0.55);
		world.notice = '波纹送出去了。跟着发光的海物去捡星光。';
	} else if (!world.holding && holding) {
		world.notice = '海面正在升起。';
	}
	world.holding = holding;
}

export function steerTide(world: TideWorld, x: number, z: number) {
	world.steerX = x;
	world.steerZ = z;
}

export function clearSteer(world: TideWorld) {
	world.steerX = null;
	world.steerZ = null;
}

export function selectCreature(world: TideWorld, id: number) {
	if (world.creatures.some((c) => c.id === id)) {
		world.selected = id;
		const kind = world.creatures.find((c) => c.id === id)?.kind;
		world.notice =
			kind === 'jelly' ? '水母跟着你。' : kind === 'lantern' ? '灯鱼跟着你。' : '蝠鲼跟着你。';
	}
}

export function cycleCreature(world: TideWorld, dir: 1 | -1) {
	const ids = world.creatures.map((c) => c.id);
	const i = ids.indexOf(world.selected);
	const next = ids[(i + dir + ids.length) % ids.length];
	if (next != null) selectCreature(world, next);
}

export function nudgeTide(world: TideWorld, dx: number, dz: number) {
	const creature = world.creatures.find((c) => c.id === world.selected);
	if (!creature) return;
	creature.x = clamp(creature.x + dx * NUDGE, -7, 7);
	creature.z = clamp(creature.z + dz * NUDGE, -6.5, 4.5);
	if (dx || dz) creature.heading = Math.atan2(dx, dz);
	collectNear(world, creature);
}

export function setTideKey(world: TideWorld, key: keyof TideWorld['keys'], down: boolean) {
	world.keys[key] = down;
}

function collectNear(world: TideWorld, creature: Creature) {
	for (const star of world.stars) {
		if (star.collected) continue;
		if (Math.hypot(star.x - creature.x, star.z - creature.z) <= COLLECT_RADIUS) {
			star.collected = true;
			world.collected = world.stars.filter((item) => item.collected).length;
			world.notice = `捡到星光 ${world.collected} / ${STAR_COUNT}。`;
			unlockCoral(world);
		}
	}
}

function unlockCoral(world: TideWorld) {
	for (let i = 0; i < world.coral.length; i++) {
		const patch = world.coral[i]!;
		const need = CORAL_THRESHOLDS[i] ?? 99;
		if (!patch.unlocked && world.collected >= need) {
			patch.unlocked = true;
			world.notice = `一片珊瑚园醒了（${world.coral.filter((c) => c.unlocked).length} / ${world.coral.length}）。`;
		}
	}
}

function moveCreature(world: TideWorld, creature: Creature, dt: number) {
	let tx = world.steerX;
	let tz = world.steerZ;
	const selected = creature.id === world.selected;
	if (selected) {
		if (world.keys.left) tx = (tx ?? creature.x) - 1;
		if (world.keys.right) tx = (tx ?? creature.x) + 1;
		if (world.keys.up) tz = (tz ?? creature.z) - 1;
		if (world.keys.down) tz = (tz ?? creature.z) + 1;
	}
	const speed = (selected && world.holding ? STEER_SPEED : DRIFT_SPEED) * creature.speed;
	if (tx != null && tz != null && selected) {
		const dx = tx - creature.x;
		const dz = tz - creature.z;
		const dist = Math.hypot(dx, dz) || 1;
		creature.x += (dx / dist) * speed * dt;
		creature.z += (dz / dist) * speed * dt;
		creature.heading = Math.atan2(dx, dz);
	} else {
		const drift = world.swell * 0.35 + world.pulse * 0.2;
		creature.x += Math.sin(creature.heading) * DRIFT_SPEED * drift * dt;
		creature.z += Math.cos(creature.heading) * DRIFT_SPEED * drift * dt;
		creature.heading += (selected ? 0.00015 : 0.00022) * dt;
	}
	creature.x = clamp(creature.x, -7, 7);
	creature.z = clamp(creature.z, -6.5, 4.5);
	if (selected) collectNear(world, creature);
}

export function stepTide(world: TideWorld, dt: number) {
	if (world.paused || dt <= 0) return;
	let remain = dt;
	while (remain > 0) {
		const t = Math.min(remain, 50);
		remain -= t;
		world.time += t;
		world.paceHint = (Math.sin(world.time / 5000) + 1) / 2;
		if (world.holding) {
			world.swell = clamp(world.swell + SWELL_UP_PER_MS * t, 0, 1);
		} else {
			world.swell = clamp(world.swell - SWELL_DOWN_PER_MS * t, 0.04, 1);
		}
		world.pulse = clamp(world.pulse - PULSE_DECAY_PER_MS * t, 0, 1.4);
		for (const creature of world.creatures) moveCreature(world, creature, t);
		for (const patch of world.coral) {
			if (patch.unlocked) patch.growth = clamp(patch.growth + t / 1400, 0, 1);
		}
	}
}

export function restartTide(world: TideWorld) {
	const next = createTide();
	next.lowDetail = world.lowDetail;
	next.audioWanted = world.audioWanted;
	next.dockCollapsed = world.dockCollapsed;
	Object.assign(world, next);
}

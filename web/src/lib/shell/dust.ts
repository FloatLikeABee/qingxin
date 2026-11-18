export const DUST_MOTES = 36;
export const DUST_MOTES_NARROW = 24;
export const DUST_CLOUDS = 4;
export const DUST_FPS = 24;
export const DUST_FRAME_MS = 1000 / DUST_FPS;

export interface DustMote {
	x: number;
	y: number;
	vx: number;
	vy: number;
	r: number;
	a: number;
	originX: number;
	originY: number;
}

export interface DustCloud {
	x: number;
	y: number;
	r: number;
	a: number;
	vr: number;
}

export interface DustField {
	width: number;
	height: number;
	motes: DustMote[];
	clouds: DustCloud[];
}

export interface AnimateOpts {
	hidden: boolean;
	playView: boolean;
	reducedMotion: boolean;
}

function rng(seed: number) {
	let s = seed % 2147483647;
	if (s <= 0) s += 2147483646;
	return () => {
		s = (s * 16807) % 2147483647;
		return (s - 1) / 2147483646;
	};
}

function clusters(width: number, height: number, rand: () => number) {
	return Array.from({ length: 3 }, () => ({
		x: width * (0.2 + rand() * 0.6),
		y: height * (0.2 + rand() * 0.6)
	}));
}

function spawnMote(
	width: number,
	height: number,
	origins: Array<{ x: number; y: number }>,
	rand: () => number
): DustMote {
	const origin = origins[Math.floor(rand() * origins.length)] ?? { x: width / 2, y: height / 2 };
	const angle = rand() * Math.PI * 2;
	const dist = 8 + rand() * 28;
	const speed = 0.006 + rand() * 0.014;
	return {
		originX: origin.x,
		originY: origin.y,
		x: origin.x + Math.cos(angle) * dist,
		y: origin.y + Math.sin(angle) * dist,
		vx: Math.cos(angle) * speed,
		vy: Math.sin(angle) * speed,
		r: 0.85 + rand() * 1.85,
		a: 0.14 + rand() * 0.22
	};
}

function spawnCloud(width: number, height: number, rand: () => number): DustCloud {
	return {
		x: width * (0.15 + rand() * 0.7),
		y: height * (0.15 + rand() * 0.7),
		r: Math.min(width, height) * (0.18 + rand() * 0.16),
		a: 0.11 + rand() * 0.08,
		vr: 0.004 + rand() * 0.006
	};
}

export function createDustField(seed: number, width: number, height: number): DustField {
	const rand = rng(seed * 9973 + Math.round(width) + Math.round(height));
	const origins = clusters(width, height, rand);
	const count = width < 500 ? DUST_MOTES_NARROW : DUST_MOTES;
	return {
		width,
		height,
		motes: Array.from({ length: count }, () => spawnMote(width, height, origins, rand)),
		clouds: Array.from({ length: DUST_CLOUDS }, () => spawnCloud(width, height, rand))
	};
}

export function shouldAnimateDust(opts: AnimateOpts) {
	return !opts.hidden && !opts.playView && !opts.reducedMotion;
}

export function stepDust(
	field: DustField,
	dt: number,
	opts: { reducedMotion: boolean }
): DustField {
	if (opts.reducedMotion || dt <= 0) return field;
	const t = Math.min(dt, 48);
	const rand = rng(Math.round(field.motes[0]?.x ?? 1) * 13 + field.width);
	const origins = clusters(field.width, field.height, rand);
	const motes = field.motes.map((mote) => {
		let x = mote.x + mote.vx * t;
		let y = mote.y + mote.vy * t;
		let a = mote.a * (1 - t * 0.00025);
		const away = Math.hypot(x - mote.originX, y - mote.originY);
		if (
			a < 0.02 ||
			away > Math.min(field.width, field.height) * 0.55 ||
			x < -40 ||
			y < -40 ||
			x > field.width + 40 ||
			y > field.height + 40
		) {
			return spawnMote(field.width, field.height, origins, rand);
		}
		return { ...mote, x, y, a };
	});
	const clouds = field.clouds.map((cloud) => {
		let r = cloud.r + cloud.vr * t;
		let a = cloud.a * (1 - t * 0.00018);
		if (a < 0.012 || r > Math.min(field.width, field.height) * 0.55) {
			return spawnCloud(field.width, field.height, rand);
		}
		return { ...cloud, r, a };
	});
	return { ...field, motes, clouds };
}

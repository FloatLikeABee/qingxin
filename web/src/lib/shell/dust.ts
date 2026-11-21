export const DUST_MOTES = 36;
export const DUST_MOTES_NARROW = 24;
export const DUST_WAVES = 3;
export const DUST_LIGHTS = 2;
export const DUST_STARS_FAR = 48;
export const DUST_STARS_FAR_NARROW = 28;
export const DUST_STARS_NEAR = 14;
export const DUST_STARS_NEAR_NARROW = 8;
export const DUST_FPS = 24;
export const DUST_FRAME_MS = 1000 / DUST_FPS;
export const DUST_STEP_CAP_MS = 48;

export type WaveTint = 'blue' | 'violet';

export interface DustMote {
	x: number;
	y: number;
	vx: number;
	vy: number;
	r: number;
	a: number;
	originX: number;
	originY: number;
	wave: number;
}

export interface DustWave {
	baseY: number;
	amp: number;
	wavelength: number;
	phase: number;
	speed: number;
	thickness: number;
	tint: WaveTint;
	alpha: number;
}

export interface DustStar {
	x: number;
	y: number;
	r: number;
	a: number;
	vx: number;
	vy: number;
}

export interface DustLight {
	x: number;
	y: number;
	r: number;
	a: number;
	cx: number;
	cy: number;
	orbit: number;
	theta: number;
	tint: WaveTint;
}

export interface DustField {
	width: number;
	height: number;
	waves: DustWave[];
	motes: DustMote[];
	starsFar: DustStar[];
	starsNear: DustStar[];
	lights: DustLight[];
}

export interface AnimateOpts {
	hidden: boolean;
	playView: boolean;
	reducedMotion: boolean;
}

function mulberry32(seed: number) {
	let t = seed >>> 0;
	return () => {
		t += 0x6d2b79f5;
		let n = t;
		n = Math.imul(n ^ (n >>> 15), n | 1);
		n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
		return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
	};
}

export function waveY(wave: DustWave, x: number, height: number): number {
	return wave.baseY * height + Math.sin(x / wave.wavelength + wave.phase) * wave.amp;
}

function spawnWaves(width: number, height: number, rand: () => number): DustWave[] {
	const tints: WaveTint[] = ['blue', 'violet', 'blue'];
	return tints.map((tint, index) => ({
		baseY: 0.28 + index * 0.22 + (rand() - 0.5) * 0.04,
		amp: height * (0.045 + rand() * 0.03),
		wavelength: width * (0.22 + rand() * 0.12),
		phase: rand() * Math.PI * 2,
		speed: 0.00012 + rand() * 0.00008,
		thickness: height * (0.09 + rand() * 0.04),
		tint,
		alpha: tint === 'violet' ? 0.13 + rand() * 0.05 : 0.16 + rand() * 0.06
	}));
}

function spawnMote(width: number, height: number, waves: DustWave[], rand: () => number): DustMote {
	const waveIndex = Math.floor(rand() * waves.length) % Math.max(1, waves.length);
	const wave = waves[waveIndex]!;
	const x = rand() * width;
	const y = waveY(wave, x, height) + (rand() - 0.5) * wave.thickness * 0.7;
	return {
		x,
		y,
		vx: 0.018 + rand() * 0.022,
		vy: (rand() - 0.5) * 0.006,
		r: 0.7 + rand() * 1.35,
		a: 0.16 + rand() * 0.2,
		originX: x,
		originY: y,
		wave: waveIndex
	};
}

function spawnStar(width: number, height: number, rand: () => number, near: boolean): DustStar {
	return {
		x: rand() * width,
		y: rand() * height,
		r: near ? 1.05 + rand() * 0.85 : 0.4 + rand() * 0.5,
		a: near ? 0.26 + rand() * 0.2 : 0.11 + rand() * 0.14,
		vx: near ? 0.0035 + rand() * 0.004 : 0.0012 + rand() * 0.0022,
		vy: (rand() - 0.5) * (near ? 0.0018 : 0.0009)
	};
}

function spawnLight(width: number, height: number, rand: () => number, tint: WaveTint): DustLight {
	const cx = width * (0.22 + rand() * 0.56);
	const cy = height * (0.22 + rand() * 0.5);
	return {
		cx,
		cy,
		x: cx,
		y: cy,
		r: Math.min(width, height) * (0.22 + rand() * 0.1),
		a: tint === 'violet' ? 0.09 + rand() * 0.04 : 0.11 + rand() * 0.04,
		orbit: 0.00004 + rand() * 0.00003,
		theta: rand() * Math.PI * 2,
		tint
	};
}

function wrap(value: number, max: number, pad: number) {
	if (value < -pad) return max + pad;
	if (value > max + pad) return -pad;
	return value;
}

export function createDustField(seed: number, width: number, height: number): DustField {
	const rand = mulberry32(seed * 9973 + Math.round(width) + Math.round(height));
	const waves = spawnWaves(width, height, rand);
	const narrow = width < 500;
	return {
		width,
		height,
		waves,
		motes: Array.from({ length: narrow ? DUST_MOTES_NARROW : DUST_MOTES }, () =>
			spawnMote(width, height, waves, rand)
		),
		starsFar: Array.from({ length: narrow ? DUST_STARS_FAR_NARROW : DUST_STARS_FAR }, () =>
			spawnStar(width, height, rand, false)
		),
		starsNear: Array.from({ length: narrow ? DUST_STARS_NEAR_NARROW : DUST_STARS_NEAR }, () =>
			spawnStar(width, height, rand, true)
		),
		lights: [
			spawnLight(width, height, rand, 'blue'),
			spawnLight(width, height, rand, 'violet')
		].slice(0, DUST_LIGHTS)
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
	const t = Math.min(dt, DUST_STEP_CAP_MS);
	const rand = mulberry32(Math.round((field.motes[0]?.x ?? 1) * 13 + field.width));
	const waves = field.waves.map((wave) => ({
		...wave,
		phase: wave.phase + wave.speed * t
	}));
	const motes = field.motes.map((mote) => {
		let x = mote.x + mote.vx * t;
		const wave = waves[mote.wave] ?? waves[0]!;
		let y =
			waveY(wave, x, field.height) + (mote.y - waveY(wave, mote.x, field.height)) + mote.vy * t;
		if (x > field.width + 36 || x < -36 || y < -40 || y > field.height + 40) {
			return spawnMote(field.width, field.height, waves, rand);
		}
		return { ...mote, x, y };
	});
	const driftStar = (star: DustStar): DustStar => ({
		...star,
		x: wrap(star.x + star.vx * t, field.width, 8),
		y: wrap(star.y + star.vy * t, field.height, 8)
	});
	const lights = field.lights.map((light) => {
		const theta = light.theta + light.orbit * t;
		const radius = Math.min(field.width, field.height) * 0.06;
		return {
			...light,
			theta,
			x: light.cx + Math.cos(theta) * radius,
			y: light.cy + Math.sin(theta) * radius * 0.55
		};
	});
	return {
		...field,
		waves,
		motes,
		starsFar: field.starsFar.map(driftStar),
		starsNear: field.starsNear.map(driftStar),
		lights
	};
}

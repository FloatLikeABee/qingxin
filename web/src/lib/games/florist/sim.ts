import { emptyBuckets, STEMS, STEM_IDS, type Mood, type StemId } from './stems';

export interface GuestWant {
	id: number;
	mood: Mood;
	prefer?: StemId;
	wait: number;
	patience: number;
}

export interface Bouquet {
	stems: StemId[];
	madeAt: number;
}

export interface FloristStats {
	happy: number;
	unhappy: number;
}

export interface FloristState {
	tick: number;
	prepTicks: number;
	dayGuests: number;
	paused: boolean;
	over: boolean;
	phase: 'prep' | 'open';
	autoCustomers: boolean;
	spawnEvery: number;
	spawnWait: number;
	patience: number;
	buckets: Record<StemId, number>;
	assembling: StemId[];
	window: Array<Bouquet | null>;
	guest: GuestWant | null;
	stats: FloristStats;
	nextId: number;
	rng: () => number;
}

export interface FloristOptions {
	seed?: number;
	autoCustomers?: boolean;
	patience?: number;
	prepTicks?: number;
	dayGuests?: number;
}

export interface FloristSummary {
	happy: number;
	unhappy: number;
	satisfaction: number;
	windowLeft: number;
}

function mulberry32(seed: number): () => number {
	let t = seed >>> 0;
	return () => {
		t += 0x6d2b79f5;
		let n = t;
		n = Math.imul(n ^ (n >>> 15), n | 1);
		n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
		return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
	};
}

export function bouquetMood(stems: StemId[]): Mood | null {
	const votes: Record<Mood, number> = { 暖: 0, 静: 0, 亮: 0 };
	for (const stem of stems) {
		const def = STEMS[stem];
		if (def.greenery) continue;
		votes[def.mood] += 1;
	}
	const ranked = (Object.entries(votes) as [Mood, number][]).sort((a, b) => b[1] - a[1]);
	const top = ranked[0];
	if (!top || top[1] === 0) return stems.length ? '静' : null;
	return top[0];
}

export function scoreOffer(
	stems: StemId[],
	want: { mood: Mood; prefer?: StemId },
	tick: number,
	madeAt: number
): number {
	if (stems.length === 0) return 0;
	let score = 0;
	if (bouquetMood(stems) === want.mood) score += 0.55;
	if (want.prefer && stems.includes(want.prefer)) score += 0.25;
	const fresh = Math.max(0, 1 - (tick - madeAt) / 120);
	score += 0.2 * fresh;
	return Math.min(1, score);
}

export function createFlorist(options: FloristOptions = {}): FloristState {
	return {
		tick: 0,
		prepTicks: options.prepTicks ?? 90,
		dayGuests: options.dayGuests ?? 4,
		paused: false,
		over: false,
		phase: 'prep',
		autoCustomers: options.autoCustomers ?? true,
		spawnEvery: 22,
		spawnWait: 6,
		patience: options.patience ?? 36,
		buckets: emptyBuckets(),
		assembling: [],
		window: [null, null, null],
		guest: null,
		stats: { happy: 0, unhappy: 0 },
		nextId: 1,
		rng: mulberry32(options.seed ?? 20261113)
	};
}

export function addStem(sim: FloristState, stem: StemId): boolean {
	if (sim.over || sim.assembling.length >= 5) return false;
	if (sim.buckets[stem] <= 0) return false;
	sim.buckets[stem] -= 1;
	sim.assembling.push(stem);
	return true;
}

export function undoStem(sim: FloristState): boolean {
	const last = sim.assembling.pop();
	if (!last) return false;
	sim.buckets[last] += 1;
	return true;
}

export function putInWindow(sim: FloristState, slot: number): boolean {
	if (sim.over || sim.assembling.length === 0) return false;
	if (slot < 0 || slot > 2) return false;
	sim.window[slot] = { stems: [...sim.assembling], madeAt: sim.tick };
	sim.assembling = [];
	return true;
}

export function openShop(sim: FloristState) {
	if (sim.over) return;
	sim.phase = 'open';
}

function settleGuest(sim: FloristState, happy: boolean) {
	if (happy) sim.stats.happy += 1;
	else sim.stats.unhappy += 1;
	sim.guest = null;
	if (sim.stats.happy + sim.stats.unhappy >= sim.dayGuests) sim.over = true;
}

function serve(sim: FloristState, stems: StemId[], madeAt: number): boolean {
	if (!sim.guest || stems.length === 0) return false;
	const score = scoreOffer(stems, sim.guest, sim.tick, madeAt);
	settleGuest(sim, score >= 0.5);
	return true;
}

export function handAssembling(sim: FloristState): boolean {
	if (sim.over || sim.phase !== 'open') return false;
	const stems = [...sim.assembling];
	const ok = serve(sim, stems, sim.tick);
	if (ok) sim.assembling = [];
	return ok;
}

export function handWindow(sim: FloristState, slot: number): boolean {
	if (sim.over || sim.phase !== 'open') return false;
	const bouquet = sim.window[slot];
	if (!bouquet) return false;
	const ok = serve(sim, bouquet.stems, bouquet.madeAt);
	if (ok) sim.window[slot] = null;
	return ok;
}

function spawnGuest(sim: FloristState) {
	const moods: Mood[] = ['暖', '静', '亮'];
	const mood = moods[Math.floor(sim.rng() * moods.length)] ?? '暖';
	const blooms = STEM_IDS.filter((id) => !STEMS[id].greenery && STEMS[id].mood === mood);
	const prefer = sim.rng() > 0.45 ? blooms[Math.floor(sim.rng() * blooms.length)] : undefined;
	sim.guest = {
		id: sim.nextId++,
		mood,
		prefer,
		wait: 0,
		patience: sim.patience
	};
	sim.spawnWait = sim.spawnEvery;
}

export function tickFlorist(sim: FloristState): FloristState {
	if (sim.paused || sim.over) return sim;
	sim.tick += 1;
	if (sim.phase === 'prep' && sim.tick >= sim.prepTicks) openShop(sim);
	if (sim.phase === 'open' && sim.autoCustomers && !sim.guest) {
		sim.spawnWait -= 1;
		if (sim.spawnWait <= 0) spawnGuest(sim);
	}
	if (sim.guest) {
		sim.guest.wait += 1;
		if (sim.guest.wait > sim.guest.patience) settleGuest(sim, false);
	}
	return sim;
}

export function summarizeFlorist(sim: FloristState): FloristSummary {
	const guests = sim.stats.happy + sim.stats.unhappy;
	return {
		happy: sim.stats.happy,
		unhappy: sim.stats.unhappy,
		satisfaction: guests === 0 ? 1 : sim.stats.happy / guests,
		windowLeft: sim.window.filter(Boolean).length
	};
}

export function restartFlorist(sim: FloristState, options?: FloristOptions): FloristState {
	Object.assign(sim, createFlorist(options));
	return sim;
}

export function guestLine(guest: GuestWant): string {
	const flower = guest.prefer ? `，带点${STEMS[guest.prefer].name}` : '';
	return `想要一束${guest.mood}的${flower}`;
}

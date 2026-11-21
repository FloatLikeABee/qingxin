type Graph = {
	ctx: AudioContext;
	master: GainNode;
	room: GainNode;
	noise: AudioBufferSourceNode;
};

let graph: Graph | null = null;
let unlocked = false;

function makeNoise(ctx: AudioContext) {
	const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	let last = 0;
	for (let i = 0; i < data.length; i++) {
		last = last * 0.98 + (Math.random() * 2 - 1) * 0.02;
		data[i] = last;
	}
	const src = ctx.createBufferSource();
	src.buffer = buffer;
	src.loop = true;
	const filter = ctx.createBiquadFilter();
	filter.type = 'lowpass';
	filter.frequency.value = 240;
	src.connect(filter);
	return { src, filter };
}

export function shelfAudioUnlocked() {
	return unlocked;
}

export async function unlockShelfAudio() {
	const AudioCtx =
		window.AudioContext ||
		(window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!AudioCtx) return false;
	const ctx = graph?.ctx ?? new AudioCtx();
	if (ctx.state === 'suspended') await ctx.resume();
	if (!graph) {
		const master = ctx.createGain();
		master.gain.value = 0.15;
		master.connect(ctx.destination);
		const room = ctx.createGain();
		room.gain.value = 0.28;
		const { src, filter } = makeNoise(ctx);
		filter.connect(room);
		room.connect(master);
		src.start();
		graph = { ctx, master, room, noise: src };
	}
	unlocked = true;
	return true;
}

export function setShelfMuted(muted: boolean) {
	if (!graph) return;
	graph.master.gain.value = muted ? 0 : 0.15;
}

function tone(freqFrom: number, freqTo: number, dur: number, peak: number) {
	if (!graph || graph.master.gain.value === 0) return;
	const { ctx, master } = graph;
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = 'sine';
	osc.frequency.setValueAtTime(freqFrom, ctx.currentTime);
	osc.frequency.exponentialRampToValueAtTime(freqTo, ctx.currentTime + dur);
	gain.gain.setValueAtTime(0.0001, ctx.currentTime);
	gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + 0.03);
	gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
	osc.connect(gain);
	gain.connect(master);
	osc.start();
	osc.stop(ctx.currentTime + dur + 0.02);
}

export function popShelf() {
	tone(420, 880, 0.22, 0.05);
}

export function whimperShelf() {
	tone(380, 220, 0.55, 0.06);
}

export function stopShelfAudio() {
	try {
		graph?.noise.stop();
		void graph?.ctx.close();
	} catch {
		// already closed
	}
	graph = null;
	unlocked = false;
}

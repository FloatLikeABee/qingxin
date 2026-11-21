type Graph = {
	ctx: AudioContext;
	master: GainNode;
	air: GainNode;
	noise: AudioBufferSourceNode;
};

let graph: Graph | null = null;
let unlocked = false;

function makeNoise(ctx: AudioContext) {
	const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	let last = 0;
	for (let i = 0; i < data.length; i++) {
		last = last * 0.96 + (Math.random() * 2 - 1) * 0.04;
		data[i] = last;
	}
	const src = ctx.createBufferSource();
	src.buffer = buffer;
	src.loop = true;
	const filter = ctx.createBiquadFilter();
	filter.type = 'bandpass';
	filter.frequency.value = 380;
	filter.Q.value = 0.7;
	src.connect(filter);
	return { src, filter };
}

export function skyAudioUnlocked() {
	return unlocked;
}

export async function unlockSkyAudio() {
	const AudioCtx =
		window.AudioContext ||
		(window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!AudioCtx) return false;
	const ctx = graph?.ctx ?? new AudioCtx();
	if (ctx.state === 'suspended') await ctx.resume();
	if (!graph) {
		const master = ctx.createGain();
		master.gain.value = 0.16;
		master.connect(ctx.destination);
		const air = ctx.createGain();
		air.gain.value = 0.32;
		const { src, filter } = makeNoise(ctx);
		filter.connect(air);
		air.connect(master);
		src.start();
		graph = { ctx, master, air, noise: src };
	}
	unlocked = true;
	return true;
}

export function setSkyMuted(muted: boolean) {
	if (!graph) return;
	graph.master.gain.value = muted ? 0 : 0.16;
}

export function setSkyAirGain(inWind: boolean, airborne: boolean) {
	if (!graph) return;
	graph.air.gain.value = inWind ? 0.55 : airborne ? 0.38 : 0.22;
}

export function chimeSky() {
	if (!graph || graph.master.gain.value === 0) return;
	const { ctx, master } = graph;
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = 'sine';
	osc.frequency.setValueAtTime(659, ctx.currentTime);
	osc.frequency.exponentialRampToValueAtTime(988, ctx.currentTime + 0.22);
	gain.gain.setValueAtTime(0.0001, ctx.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.03);
	gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.62);
	osc.connect(gain);
	gain.connect(master);
	osc.start();
	osc.stop(ctx.currentTime + 0.64);
}

export function stopSkyAudio() {
	try {
		graph?.noise.stop();
		void graph?.ctx.close();
	} catch {
		// already closed
	}
	graph = null;
	unlocked = false;
}

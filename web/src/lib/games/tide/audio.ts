type Graph = {
	ctx: AudioContext;
	master: GainNode;
	swell: GainNode;
	noise: AudioBufferSourceNode;
};

let graph: Graph | null = null;
let unlocked = false;

function makeNoise(ctx: AudioContext) {
	const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	let last = 0;
	for (let i = 0; i < data.length; i++) {
		last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
		data[i] = last;
	}
	const src = ctx.createBufferSource();
	src.buffer = buffer;
	src.loop = true;
	const filter = ctx.createBiquadFilter();
	filter.type = 'lowpass';
	filter.frequency.value = 420;
	src.connect(filter);
	return { src, filter };
}

export function tideAudioUnlocked() {
	return unlocked;
}

export async function unlockTideAudio() {
	const AudioCtx =
		window.AudioContext ||
		(window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!AudioCtx) return false;
	const ctx = graph?.ctx ?? new AudioCtx();
	if (ctx.state === 'suspended') await ctx.resume();
	if (!graph) {
		const master = ctx.createGain();
		master.gain.value = 0.18;
		master.connect(ctx.destination);
		const swell = ctx.createGain();
		swell.gain.value = 0.4;
		const { src, filter } = makeNoise(ctx);
		filter.connect(swell);
		swell.connect(master);
		src.start();
		graph = { ctx, master, swell, noise: src };
	}
	unlocked = true;
	return true;
}

export function setTideMuted(muted: boolean) {
	if (!graph) return;
	graph.master.gain.value = muted ? 0 : 0.18;
}

export function setTideSwellGain(swell: number) {
	if (!graph) return;
	graph.swell.gain.value = 0.28 + swell * 0.35;
}

export function chimeTide() {
	if (!graph || graph.master.gain.value === 0) return;
	const { ctx, master } = graph;
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = 'sine';
	osc.frequency.setValueAtTime(523, ctx.currentTime);
	osc.frequency.exponentialRampToValueAtTime(784, ctx.currentTime + 0.18);
	gain.gain.setValueAtTime(0.0001, ctx.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.03);
	gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
	osc.connect(gain);
	gain.connect(master);
	osc.start();
	osc.stop(ctx.currentTime + 0.52);
}

export function stopTideAudio() {
	try {
		graph?.noise.stop();
		void graph?.ctx.close();
	} catch {
		// already closed
	}
	graph = null;
	unlocked = false;
}

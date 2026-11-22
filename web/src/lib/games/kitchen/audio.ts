type Graph = {
	ctx: AudioContext;
	master: GainNode;
	sizzle: GainNode;
	noise: AudioBufferSourceNode;
};

let graph: Graph | null = null;
let unlocked = false;

function makeNoise(ctx: AudioContext) {
	const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < data.length; i++) {
		data[i] = (Math.random() * 2 - 1) * 0.35;
	}
	const src = ctx.createBufferSource();
	src.buffer = buffer;
	src.loop = true;
	const filter = ctx.createBiquadFilter();
	filter.type = 'highpass';
	filter.frequency.value = 1800;
	src.connect(filter);
	return { src, filter };
}

export function kitchenAudioUnlocked() {
	return unlocked;
}

export async function unlockKitchenAudio() {
	const AudioCtx =
		window.AudioContext ||
		(window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!AudioCtx) return false;
	const ctx = graph?.ctx ?? new AudioCtx();
	if (ctx.state === 'suspended') await ctx.resume();
	if (!graph) {
		const master = ctx.createGain();
		master.gain.value = 0.12;
		master.connect(ctx.destination);
		const sizzle = ctx.createGain();
		sizzle.gain.value = 0;
		const { src, filter } = makeNoise(ctx);
		filter.connect(sizzle);
		sizzle.connect(master);
		src.start();
		graph = { ctx, master, sizzle, noise: src };
	}
	unlocked = true;
	return true;
}

export function setKitchenMuted(muted: boolean) {
	if (!graph) return;
	graph.master.gain.value = muted ? 0 : 0.12;
}

export function setKitchenSizzle(heat: 'off' | 'low' | 'high', pieces: number) {
	if (!graph) return;
	const target = heat === 'off' || pieces === 0 ? 0 : heat === 'high' ? 0.22 : 0.1;
	graph.sizzle.gain.setTargetAtTime(target, graph.ctx.currentTime, 0.08);
}

export function stopKitchenAudio() {
	if (!graph) return;
	try {
		graph.noise.stop();
	} catch {
		// already stopped
	}
	void graph.ctx.close();
	graph = null;
	unlocked = false;
}

type Graph = {
	ctx: AudioContext;
	master: GainNode;
};

let graph: Graph | null = null;
let unlocked = false;

export function opAudioUnlocked() {
	return unlocked;
}

export async function unlockOpAudio() {
	const AudioCtx =
		window.AudioContext ||
		(window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!AudioCtx) return false;
	const ctx = graph?.ctx ?? new AudioCtx();
	if (ctx.state === 'suspended') await ctx.resume();
	if (!graph) {
		const master = ctx.createGain();
		master.gain.value = 0;
		master.connect(ctx.destination);
		graph = { ctx, master };
	}
	unlocked = true;
	return true;
}

export function setOpMuted(muted: boolean) {
	if (!graph) return;
	graph.master.gain.value = muted ? 0 : 0.12;
}

export function tickOpTool(kind: 'cut' | 'wet' | 'metal' | 'pack') {
	if (!graph || !unlocked) return;
	const { ctx, master } = graph;
	if (master.gain.value <= 0) return;
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	const filter = ctx.createBiquadFilter();
	filter.type = 'lowpass';
	if (kind === 'cut') {
		osc.type = 'sawtooth';
		osc.frequency.value = 420;
		filter.frequency.value = 1400;
	} else if (kind === 'wet') {
		osc.type = 'triangle';
		osc.frequency.value = 90;
		filter.frequency.value = 400;
	} else if (kind === 'pack') {
		osc.type = 'sine';
		osc.frequency.value = 160;
		filter.frequency.value = 600;
	} else {
		osc.type = 'square';
		osc.frequency.value = 680;
		filter.frequency.value = 2200;
	}
	gain.gain.value = 0.04;
	gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
	osc.connect(filter);
	filter.connect(gain);
	gain.connect(master);
	osc.start();
	osc.stop(ctx.currentTime + 0.1);
}

export function stopOpAudio() {
	if (!graph) return;
	graph.master.gain.value = 0;
}

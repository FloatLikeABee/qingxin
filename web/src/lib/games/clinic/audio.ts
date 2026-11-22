type Graph = {
	ctx: AudioContext;
	master: GainNode;
};

let graph: Graph | null = null;
let unlocked = false;

export async function unlockClinicAudio() {
	const AudioCtx =
		window.AudioContext ||
		(window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!AudioCtx) return false;
	const ctx = graph?.ctx ?? new AudioCtx();
	if (ctx.state === 'suspended') await ctx.resume();
	if (!graph) {
		const master = ctx.createGain();
		master.gain.value = 0.1;
		master.connect(ctx.destination);
		graph = { ctx, master };
	}
	unlocked = true;
	return true;
}

export function setClinicMuted(muted: boolean) {
	if (!graph) return;
	graph.master.gain.value = muted ? 0 : 0.1;
}

export function tickClinicJar() {
	if (!graph || !unlocked) return;
	const { ctx, master } = graph;
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = 'triangle';
	osc.frequency.value = 420;
	gain.gain.setValueAtTime(0.08, ctx.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
	osc.connect(gain);
	gain.connect(master);
	osc.start();
	osc.stop(ctx.currentTime + 0.13);
}

export function tickClinicDispense() {
	if (!graph || !unlocked) return;
	const { ctx, master } = graph;
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = 'sine';
	osc.frequency.setValueAtTime(220, ctx.currentTime);
	osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.4);
	gain.gain.setValueAtTime(0.1, ctx.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
	osc.connect(gain);
	gain.connect(master);
	osc.start();
	osc.stop(ctx.currentTime + 0.46);
}

export function stopClinicAudio() {
	if (!graph) return;
	void graph.ctx.close();
	graph = null;
	unlocked = false;
}

type Graph = {
	ctx: AudioContext;
	master: GainNode;
	engine: OscillatorNode;
	rumble: OscillatorNode;
	gain: GainNode;
};

let graph: Graph | null = null;
let unlocked = false;

export function haulAudioUnlocked() {
	return unlocked;
}

export async function unlockHaulAudio() {
	const AudioCtx =
		window.AudioContext ||
		(window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!AudioCtx) return false;
	const ctx = graph?.ctx ?? new AudioCtx();
	if (ctx.state === 'suspended') await ctx.resume();
	if (!graph) {
		const master = ctx.createGain();
		master.gain.value = 0.14;
		master.connect(ctx.destination);
		const gain = ctx.createGain();
		gain.gain.value = 0.04;
		const engine = ctx.createOscillator();
		engine.type = 'sawtooth';
		engine.frequency.value = 48;
		const rumble = ctx.createOscillator();
		rumble.type = 'triangle';
		rumble.frequency.value = 36;
		const filter = ctx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.value = 220;
		engine.connect(filter);
		rumble.connect(filter);
		filter.connect(gain);
		gain.connect(master);
		engine.start();
		rumble.start();
		graph = { ctx, master, engine, rumble, gain };
	}
	unlocked = true;
	return true;
}

export function setHaulMuted(muted: boolean) {
	if (!graph) return;
	graph.master.gain.value = muted ? 0 : 0.14;
}

export function setHaulEngine(speed: number, paused: boolean) {
	if (!graph) return;
	const abs = Math.abs(speed);
	graph.engine.frequency.value = 42 + abs * 6.4;
	graph.rumble.frequency.value = 28 + abs * 1.8;
	graph.gain.gain.value = paused ? 0.01 : 0.03 + Math.min(0.09, abs * 0.004);
}

export function stopHaulAudio() {
	if (!graph) return;
	try {
		graph.engine.stop();
		graph.rumble.stop();
		void graph.ctx.close();
	} catch {
		// already closed
	}
	graph = null;
	unlocked = false;
}

import type { SoundPreset } from './catalog';

function noiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
	const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < data.length; i += 1) {
		data[i] = Math.random() * 2 - 1;
	}
	return buffer;
}

function brownBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
	const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	let last = 0;
	for (let i = 0; i < data.length; i += 1) {
		last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
		data[i] = last * 3.5;
	}
	return buffer;
}

export class NoiseMixer {
	#ctx: AudioContext | null = null;
	#gains = new Map<string, GainNode>();
	#started = false;

	get started(): boolean {
		return this.#started;
	}

	async start(presets: SoundPreset[]): Promise<void> {
		if (this.#started) return;
		const ctx = new AudioContext();
		this.#ctx = ctx;
		if (ctx.state === 'suspended') await ctx.resume();
		for (const preset of presets) {
			const gain = ctx.createGain();
			gain.gain.value = 0;
			gain.connect(ctx.destination);
			this.#gains.set(preset.id, gain);
			this.#patch(ctx, preset.id, gain);
		}
		this.#started = true;
	}

	setLevel(id: string, value: number): void {
		const gain = this.#gains.get(id);
		if (!gain) return;
		gain.gain.setTargetAtTime(Math.max(0, Math.min(1, value)) * 0.22, gain.context.currentTime, 0.05);
	}

	async stop(): Promise<void> {
		const ctx = this.#ctx;
		this.#ctx = null;
		this.#gains.clear();
		this.#started = false;
		if (ctx) await ctx.close();
	}

	#patch(ctx: AudioContext, id: string, gain: GainNode): void {
		const source = ctx.createBufferSource();
		const filter = ctx.createBiquadFilter();
		if (id === 'rain') {
			source.buffer = noiseBuffer(ctx);
			filter.type = 'highpass';
			filter.frequency.value = 900;
		} else if (id === 'waves') {
			source.buffer = noiseBuffer(ctx, 4);
			filter.type = 'lowpass';
			filter.frequency.value = 600;
			const lfo = ctx.createOscillator();
			const lfoGain = ctx.createGain();
			lfo.frequency.value = 0.12;
			lfoGain.gain.value = 0.15;
			lfo.connect(lfoGain);
			lfoGain.connect(gain.gain);
			lfo.start();
		} else if (id === 'fan' || id === 'fire') {
			source.buffer = brownBuffer(ctx);
			filter.type = 'lowpass';
			filter.frequency.value = id === 'fan' ? 400 : 1200;
		} else {
			source.buffer = noiseBuffer(ctx);
			filter.type = 'allpass';
		}
		source.loop = true;
		source.connect(filter);
		filter.connect(gain);
		source.start();
	}
}

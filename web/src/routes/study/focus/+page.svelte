<script lang="ts">
	import { onDestroy } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import Switch from '#lib/components/Switch.svelte';
	import Disclaimer from '#lib/study/Disclaimer.svelte';
	import {
		formatMmSs,
		nextPhase,
		phaseSeconds,
		remaining,
		type FocusPhase
	} from '#lib/study/timer';

	let phase = $state<FocusPhase>('work');
	let elapsed = $state(0);
	let running = $state(false);
	let noiseOn = $state(false);
	let timer: ReturnType<typeof setInterval> | undefined;
	let ctx: AudioContext | null = null;
	let source: AudioBufferSourceNode | null = null;

	const left = $derived(remaining(phaseSeconds(phase), elapsed));

	function tick() {
		elapsed += 1;
		if (remaining(phaseSeconds(phase), elapsed) === 0) {
			phase = nextPhase(phase);
			elapsed = 0;
		}
	}

	function start() {
		if (running) return;
		running = true;
		timer = setInterval(tick, 1000);
	}

	function pause() {
		running = false;
		if (timer) clearInterval(timer);
		timer = undefined;
	}

	async function stopNoise() {
		source?.stop();
		source = null;
		await ctx?.close();
		ctx = null;
	}

	async function startNoise() {
		if (source) return;
		const audio = new AudioContext();
		ctx = audio;
		if (audio.state === 'suspended') await audio.resume();
		const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
		const node = audio.createBufferSource();
		node.buffer = buffer;
		node.loop = true;
		const gain = audio.createGain();
		gain.gain.value = 0.04;
		node.connect(gain);
		gain.connect(audio.destination);
		node.start();
		source = node;
	}

	$effect(() => {
		if (!noiseOn) return;
		void startNoise();
		return () => {
			void stopNoise();
		};
	});

	onDestroy(() => {
		pause();
		void stopNoise();
	});
</script>

<svelte:head>
	<title>轻心 · 专注</title>
</svelte:head>

<Card>
	<h1 class="text-2xl font-semibold">专注计时</h1>
	<p class="mt-2 text-base text-[var(--qx-muted)]">
		只在浏览器里跑番茄钟。无法锁机，关掉标签页就会停。
	</p>
	<p class="mt-6 text-center font-[Outfit] text-5xl tracking-tight">{formatMmSs(left)}</p>
	<p class="mt-2 text-center text-base text-[var(--qx-muted)]">
		{phase === 'work' ? '专注 25 分钟' : '休息 5 分钟'}
	</p>
	<div class="mt-6 grid grid-cols-2 gap-2">
		<Button onclick={start} disabled={running}>开始</Button>
		<Button variant="secondary" onclick={pause} disabled={!running}>暂停</Button>
	</div>
	<div class="mt-4">
		<Switch
			bind:checked={noiseOn}
			label="白噪音"
			description="只在这个标签页播放。关掉页面就会停。"
		/>
	</div>
</Card>

<Disclaimer />

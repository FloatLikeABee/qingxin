<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import { CONTROL_MIN_PX, LINK_CLASS } from '#lib/ui/affordance';
	import {
		setClinicMuted,
		stopClinicAudio,
		tickClinicDispense,
		tickClinicJar,
		unlockClinicAudio
	} from './audio';
	import { readClinicSave, writeClinicSave } from './persist';
	import type { ClinicScene } from './render';
	import {
		ACK_LABEL,
		DISCLAIMER_COPY,
		EXAMINE_LABEL,
		HERBS,
		HUD_DISCLAIMER,
		ackDisclaimer,
		advanceTalk,
		beginWrite,
		currentCase,
		dispense,
		examine,
		isCompactClinic,
		nextPatient,
		setPacks,
		setSlip,
		SLIP_MAX,
		startTalk,
		stepClinic,
		toggleJar,
		type ClinicWorld,
		type ExamineKind,
		type HerbId
	} from './sim';

	const EXAMS: ExamineKind[] = ['look', 'listen', 'pulse'];

	let { title }: { title: string } = $props();

	let world = $state<ClinicWorld>(readClinicSave());
	let sceneFailed = $state(false);
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let stageEl = $state<HTMLDivElement | null>(null);
	let dialogEl = $state<HTMLDialogElement | null>(null);
	let audioOn = $state(false);
	let jarTags = $state<Array<{ id: HerbId; text: string; x: number; y: number; on: boolean }>>([]);
	let patientTag = $state<{ text: string; x: number; y: number } | null>(null);

	function save() {
		writeClinicSave(world);
	}

	function caseNow() {
		return currentCase(world);
	}

	function paint(canvas: HTMLCanvasElement | null = canvasEl, scene: ClinicScene | null = null) {
		if (!canvas) return;
		canvas.dataset.ready = canvas.dataset.ready || '0';
		canvas.dataset.phase = world.phase;
		canvas.dataset.ack = world.disclaimerAck ? '1' : '0';
		canvas.dataset.case = world.caseId;
		canvas.dataset.talk = String(world.talkIndex);
		canvas.dataset.tags = String(world.revealedTags.length);
		canvas.dataset.jars = String(world.jars.length);
		canvas.dataset.slip = String(Array.from(world.slip).length);
		canvas.dataset.score = String(world.covered.length);
		canvas.dataset.notice = world.notice;
		canvas.dataset.anim = world.paused ? '0' : '1';
		canvas.dataset.detail = world.lowDetail ? 'low' : 'high';
		canvas.dataset.narrow = world.narrow ? '1' : '0';
		canvas.dataset.outcome =
			world.covered.length >= 2 ? 'warm' : world.covered.length === 1 ? 'partial' : 'mismatch';
		const w = canvas.clientWidth || 1;
		const h = canvas.clientHeight || 1;
		const pad = 28;
		let inbox = world.phase === 'disclaimer' ? true : true;
		const nextJars: typeof jarTags = [];
		if (scene && world.disclaimerAck) {
			const who = scene.projectPatient();
			if (who) {
				canvas.dataset.px = String(Math.round(who.x));
				canvas.dataset.py = String(Math.round(who.y));
				if (who.x < pad || who.x > w - pad || who.y < pad || who.y > h - pad) inbox = false;
				patientTag = { text: caseNow().name, x: who.x, y: Math.max(18, who.y - 22) };
			} else inbox = false;
			for (const herb of HERBS) {
				const pt = scene.projectJar(herb.id);
				if (pt) {
					canvas.setAttribute(`data-jx-${herb.id}`, String(Math.round(pt.x)));
					canvas.setAttribute(`data-jy-${herb.id}`, String(Math.round(pt.y)));
					if (pt.x < pad || pt.x > w - pad || pt.y < pad || pt.y > h - pad) inbox = false;
					nextJars.push({
						id: herb.id,
						text: herb.name,
						x: pt.x,
						y: pt.y,
						on: world.jars.some((jar) => jar.id === herb.id)
					});
				} else inbox = false;
			}
			if (nextJars.length === 12) {
				let colGap = Infinity;
				let rowGap = Infinity;
				for (let i = 0; i < 12; i++) {
					if (i % 4 !== 3) colGap = Math.min(colGap, Math.abs(nextJars[i + 1]!.x - nextJars[i]!.x));
					if (i < 8) rowGap = Math.min(rowGap, Math.abs(nextJars[i + 4]!.y - nextJars[i]!.y));
				}
				if (colGap < 50 || rowGap < 46) {
					const cx = nextJars.reduce((sum, tag) => sum + tag.x, 0) / 12;
					const cy = nextJars.reduce((sum, tag) => sum + tag.y, 0) / 12;
					const dx = 54;
					const dy = 50;
					for (let i = 0; i < 12; i++) {
						const tag = nextJars[i]!;
						tag.x = cx + ((i % 4) - 1.5) * dx;
						tag.y = cy + (Math.floor(i / 4) - 1) * dy;
					}
				}
			}
		}
		canvas.dataset.inbox = inbox ? '1' : '0';
		jarTags = nextJars;
	}

	function ack() {
		ackDisclaimer(world);
		save();
		paint();
		dialogEl?.close();
	}

	function talk() {
		if (world.phase === 'hall') startTalk(world);
		advanceTalk(world);
		save();
		paint();
	}

	function doExamine(kind: ExamineKind) {
		examine(world, kind);
		save();
		paint();
	}

	function writeSlip() {
		beginWrite(world);
		save();
		paint();
	}

	function onSlip(event: Event) {
		const value = (event.currentTarget as HTMLTextAreaElement).value;
		setSlip(world, value);
		paint();
	}

	function pickJar(id: HerbId) {
		toggleJar(world, id);
		if (audioOn) tickClinicJar();
		save();
		paint();
	}

	function packsOf(id: HerbId) {
		return world.jars.find((jar) => jar.id === id)?.packs ?? 1;
	}

	function bumpPacks(id: HerbId, delta: number) {
		setPacks(world, id, packsOf(id) + delta);
		save();
		paint();
	}

	function grab(event: SubmitEvent) {
		event.preventDefault();
		if (dispense(world) && audioOn) tickClinicDispense();
		save();
		paint();
	}

	function later() {
		nextPatient(world);
		save();
		paint();
	}

	function togglePause() {
		world.paused = !world.paused;
		paint();
	}

	function toggleDock() {
		world.dockCollapsed = !world.dockCollapsed;
		save();
	}

	function toggleDetail() {
		world.lowDetail = !world.lowDetail;
		save();
		paint();
	}

	async function toggleAudio() {
		if (!audioOn) {
			const ok = await unlockClinicAudio();
			if (!ok) return;
			audioOn = true;
			world.audioWanted = true;
			setClinicMuted(false);
			save();
			paint();
			return;
		}
		audioOn = false;
		world.audioWanted = false;
		setClinicMuted(true);
		save();
		paint();
	}

	$effect(() => {
		const el = dialogEl;
		if (!el) return;
		if (world.phase === 'disclaimer' && !el.open) el.showModal();
		if (world.phase !== 'disclaimer' && el.open) el.close();
	});

	onMount(() => {
		world = readClinicSave();
		if (world.audioWanted) world.audioWanted = false;
		let scene: ClinicScene | null = null;
		let raf = 0;
		let last = performance.now();
		const canvas = canvasEl;
		const stage = stageEl;
		if (!canvas || !stage) return;
		let cancelled = false;
		let resizeObserver: ResizeObserver | undefined;
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

		const onDown = (event: PointerEvent) => {
			if (event.pointerType === 'mouse' && event.button !== 0) return;
			if (world.paused || !world.disclaimerAck) return;
			const hit = scene?.hit(event.clientX, event.clientY);
			if (hit?.zone === 'patient') talk();
			if (hit?.zone === 'jar') pickJar(hit.id);
		};

		void (async () => {
			const { mountClinicScene } = await import('./render');
			if (cancelled) return;
			scene = mountClinicScene(canvas);
			if (!scene) sceneFailed = true;
			else scene.resize();
			canvas.dataset.ready = '1';
			scene?.sync(world, { reducedMotion: motion.matches });
			paint(canvas, scene);
			world.narrow = isCompactClinic(stage.clientWidth || window.innerWidth);
			resizeObserver = new ResizeObserver(() => {
				world.narrow = isCompactClinic(stage.clientWidth || window.innerWidth);
				scene?.resize();
				scene?.sync(world, { reducedMotion: motion.matches });
				paint(canvas, scene);
			});
			resizeObserver.observe(stage);
			const loop = (now: number) => {
				const dt = Math.min(48, now - last);
				last = now;
				if (!world.paused && !document.hidden) stepClinic(world, dt);
				scene?.sync(world, { reducedMotion: motion.matches });
				scene?.render(now);
				paint(canvas, scene);
				raf = requestAnimationFrame(loop);
			};
			raf = requestAnimationFrame(loop);
		})();

		stage.addEventListener('pointerdown', onDown);
		window.addEventListener('pagehide', save);
		const interval = setInterval(save, 4000);
		return () => {
			cancelled = true;
			cancelAnimationFrame(raf);
			clearInterval(interval);
			resizeObserver?.disconnect();
			stage.removeEventListener('pointerdown', onDown);
			window.removeEventListener('pagehide', save);
			scene?.dispose();
			stopClinicAudio();
			save();
		};
	});
</script>

<svelte:head>
	<title>轻心 · {title}</title>
</svelte:head>

<dialog
	bind:this={dialogEl}
	class="gate"
	aria-labelledby="clinic-ack-title"
	oncancel={(event) => {
		if (!world.disclaimerAck) event.preventDefault();
	}}
>
	<form method="dialog" onsubmit={ack}>
		<h2 id="clinic-ack-title">中医馆</h2>
		<p class="gate-copy">{DISCLAIMER_COPY}</p>
		<ul>
			<li>病例、客人、回访都是编的。</li>
			<li>药名只是气味标签。数量是药包，不是克或钱。</li>
			<li>不能当医嘱，也不是诊疗。</li>
		</ul>
		<Button class="ack" type="submit">{ACK_LABEL}</Button>
	</form>
</dialog>

<div
	class="clinic-play"
	data-play="clinic"
	data-phase={world.phase}
	data-ack={world.disclaimerAck ? '1' : '0'}
	data-case={world.caseId}
>
	<header class="top qx-glass" data-clinic-top="1">
		<a href="/modules/games" class="{LINK_CLASS} shrink-0">← 返回目录</a>
		<h1 class="sr-only">{title}</h1>
		<p class="mark">{HUD_DISCLAIMER}</p>
		<div class="top-actions">
			<Button variant="secondary" class="px-4" type="button" onclick={togglePause}>
				{world.paused ? '继续' : '暂停'}
			</Button>
			<Button variant="secondary" class="px-4" type="button" onclick={toggleDock}>
				{world.dockCollapsed ? '展开操作' : '收起操作'}
			</Button>
		</div>
	</header>

	<div bind:this={stageEl} class="stage" data-clinic-stage="1">
		<canvas bind:this={canvasEl} class="h-full w-full" aria-label="中医馆候诊厅"></canvas>
		{#if patientTag && world.disclaimerAck}
			<span
				class="who-tag"
				data-patient-label="1"
				style="left:{patientTag.x}px; top:{patientTag.y}px">{patientTag.text}</span
			>
		{/if}
		{#each jarTags as tag (tag.id)}
			<button
				type="button"
				class="jar-tag"
				class:on={tag.on}
				data-jar-label={tag.id}
				style="left:{tag.x}px; top:{tag.y}px; min-width:{CONTROL_MIN_PX}px; min-height:{CONTROL_MIN_PX}px"
				onclick={() => pickJar(tag.id)}>{tag.text}</button
			>
		{/each}
		<p class="sr-only" aria-live="polite">{world.notice}</p>
		{#if world.phase === 'recovery'}
			<aside class="recovery-card" data-recovery="1">
				<p>{world.recovery}</p>
				<Button class="min-h-12 px-5" type="button" onclick={later}>下一位</Button>
			</aside>
		{/if}
		{#if sceneFailed}
			<p class="fail">这台设备画不出三维候诊厅。仍可听故事、写纸条、点药罐。</p>
			<div class="flat" data-flat="1">
				<button type="button" class="chip" onclick={talk}>{caseNow().name}</button>
				<div class="flat-jars">
					{#each HERBS as herb (herb.id)}
						<button type="button" class="chip" onclick={() => pickJar(herb.id)}>{herb.name}</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	{#if !world.dockCollapsed && world.disclaimerAck}
		<section class="dock qx-glass" aria-label="中医馆操作">
			{#if world.phase === 'recovery'}
				<Button class="min-h-12 px-5" type="button" onclick={later}>下一位</Button>
			{:else}
				<div class="dock-scroll">
					<p class="notice" aria-live="polite">{world.notice}</p>
					<p class="need">{HUD_DISCLAIMER} 听完故事再写纸条、选二到五只罐子。</p>
					{#if world.revealedTags.length}
						<p class="tags" data-story-tags="1">故事标签：{world.revealedTags.join('、')}</p>
					{/if}
					{#if world.phase === 'hall' || world.phase === 'talk' || world.phase === 'examine'}
						<div class="actions">
							<Button class="min-h-12 px-5" variant="secondary" type="button" onclick={talk}
								>往下听</Button
							>
							<fieldset class="exam">
								<legend>诊察手势</legend>
								{#each EXAMS as kind (kind)}
									<button
										type="button"
										class="heat-chip"
										style="min-width:{CONTROL_MIN_PX}px;min-height:{CONTROL_MIN_PX}px"
										onclick={() => doExamine(kind)}>{EXAMINE_LABEL[kind]}</button
									>
								{/each}
							</fieldset>
							<Button class="min-h-12 px-5" variant="secondary" type="button" onclick={writeSlip}
								>写纸条</Button
							>
						</div>
					{/if}
					<form id="clinic-slip-form" class="slip" aria-labelledby="slip-label" onsubmit={grab}>
						{#if world.phase === 'write' || world.phase === 'dispense' || world.slip}
							<label id="slip-label" for="clinic-slip">药方纸条（最多 {SLIP_MAX} 字）</label>
							<textarea
								id="clinic-slip"
								name="slip"
								maxlength={SLIP_MAX}
								rows="2"
								value={world.slip}
								oninput={onSlip}
								enterkeyhint="done"></textarea>
							<p class="hint">{Array.from(world.slip).length}/{SLIP_MAX} · 数量是药包</p>
						{/if}
					</form>
				</div>
				{#if world.jars.length}
					<ul class="picked">
						{#each world.jars as jar (jar.id)}
							<li>
								{HERBS.find((herb) => herb.id === jar.id)?.name}
								<button type="button" class="tiny" onclick={() => bumpPacks(jar.id, -1)}>-</button>
								<span data-packs={jar.id}>{jar.packs} 药包</span>
								<button type="button" class="tiny" onclick={() => bumpPacks(jar.id, 1)}>+</button>
							</li>
						{/each}
					</ul>
				{/if}
				<Button class="grab min-h-12 px-5" type="submit" form="clinic-slip-form">抓药</Button>
				<div class="actions extras">
					<Button class="min-h-12 px-5" variant="secondary" type="button" onclick={toggleDetail}>
						{world.lowDetail ? '高细腻' : '低细腻'}
					</Button>
					<Button class="min-h-12 px-5" variant="secondary" type="button" onclick={toggleAudio}>
						{audioOn ? '静音' : '馆里的声音'}
					</Button>
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	.clinic-play {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100dvh;
		min-height: 0;
		overflow: hidden;
		background: #f4e4c8;
		user-select: none;
		-webkit-user-select: none;
	}

	.gate {
		border: 0;
		border-radius: 1.15rem;
		padding: 1.2rem 1.3rem;
		max-width: 28rem;
		background: color-mix(in srgb, var(--qx-card) 92%, #fff6e8);
		overscroll-behavior: contain;
	}

	.gate::backdrop {
		background: rgb(40 24 10 / 0.45);
	}

	.gate-copy,
	.need,
	.hint {
		text-wrap: pretty;
	}

	.top {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin: 0.4rem 0.65rem 0;
		padding: 0.4rem 0.6rem;
		padding-top: max(0.4rem, env(safe-area-inset-top, 0px));
		border-radius: 1.15rem;
		z-index: 10;
	}

	.mark {
		flex: 1;
		margin: 0;
		text-align: center;
		font-size: 0.82rem;
		font-weight: 700;
		text-wrap: pretty;
	}

	.top-actions {
		display: flex;
		gap: 0.35rem;
		flex-shrink: 0;
	}

	@media (max-width: 640px) {
		.top {
			flex-wrap: wrap;
		}

		.mark {
			order: 3;
			flex: 1 0 100%;
			font-size: 0.72rem;
		}

		.top-actions {
			margin-left: auto;
		}
	}

	.stage {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow: hidden;
		touch-action: none;
		cursor: grab;
	}

	.who-tag,
	.jar-tag {
		position: absolute;
		transform: translate(-50%, -50%);
		z-index: 3;
		padding: 0.08rem 0.38rem;
		border-radius: 999px;
		border: 0;
		background: #fff6e8;
		color: #4a2a12;
		font-size: 0.62rem;
		font-weight: 800;
		white-space: nowrap;
		box-shadow: 0 4px 10px rgb(80 40 10 / 0.16);
	}

	.who-tag {
		pointer-events: none;
	}

	.recovery-card {
		position: absolute;
		left: 0.55rem;
		right: 0.55rem;
		bottom: 0.55rem;
		z-index: 5;
		padding: 0.7rem 0.85rem;
		border-radius: 1rem;
		background: color-mix(in srgb, var(--qx-card) 92%, #fff6e8);
		box-shadow: 0 10px 24px rgb(80 40 10 / 0.18);
		max-height: 42%;
		overflow: auto;
	}

	.recovery-card p {
		margin: 0 0 0.45rem;
		font-weight: 700;
		text-wrap: pretty;
	}

	.jar-tag.on {
		background: #e36b2a;
		color: white;
	}

	.fail {
		position: absolute;
		left: 0.8rem;
		right: 0.8rem;
		top: 0.6rem;
		margin: 0;
		text-wrap: pretty;
	}

	.flat,
	.flat-jars,
	.actions,
	.exam,
	.picked {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.chip,
	.heat-chip,
	.tiny {
		min-width: 44px;
		min-height: 44px;
		border-radius: 0.85rem;
		border: 0;
		padding: 0.35rem 0.7rem;
		font-weight: 600;
	}

	.tiny {
		min-width: 44px;
		padding: 0.2rem 0.55rem;
	}

	.dock {
		display: flex;
		flex-direction: column;
		margin: 0 0.65rem 0.55rem;
		padding: 0.65rem 0.75rem;
		padding-bottom: max(0.65rem, env(safe-area-inset-bottom, 0px));
		border-radius: 1.15rem;
		z-index: 10;
		max-height: 42%;
		min-height: 0;
		overscroll-behavior: contain;
	}

	.dock-scroll {
		min-height: 0;
		overflow: auto;
		overscroll-behavior: contain;
	}

	.grab {
		flex-shrink: 0;
	}

	.notice {
		margin: 0 0 0.25rem;
		font-weight: 650;
		text-wrap: pretty;
	}

	.need,
	.tags {
		margin: 0 0 0.45rem;
		color: var(--qx-muted);
		font-size: 0.92rem;
	}

	.exam {
		border: 0;
		margin: 0;
		padding: 0;
	}

	.heat-chip {
		background: color-mix(in srgb, var(--qx-card) 70%, #f4d7a8);
	}

	.slip {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.28rem;
		margin: 0.45rem 0;
	}

	.slip textarea {
		width: 100%;
		min-height: 2.8rem;
		border-radius: 0.85rem;
		border: 0;
		padding: 0.55rem 0.7rem;
		font: inherit;
		background: #fff6e8;
	}

	@media (max-width: 640px) {
		.need,
		.extras {
			display: none;
		}

		.dock {
			max-height: 38%;
		}

		.slip textarea {
			min-height: 2.4rem;
		}
	}

	.picked {
		list-style: none;
		margin: 0;
		padding: 0;
		font-weight: 650;
	}

	@media (pointer: coarse) {
		.heat-chip,
		.chip,
		.tiny {
			min-block-size: 44px;
			min-inline-size: 44px;
		}
	}
</style>

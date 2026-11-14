<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import { readShooterSave, writeShooterScore, type ShooterSave } from './persist';
	import {
		advance,
		createShooter,
		pauseShooter,
		restartShooter,
		setAim,
		WORLD_H,
		WORLD_W
	} from './sim';

	let { title }: { title: string } = $props();

	let world = $state(createShooter({ seed: Date.now() }));
	let best = $state({ best: 0 } as ShooterSave);
	let recorded = $state(false);
	let canvasEl = $state(null as HTMLCanvasElement | null);
	let stageEl = $state(null as HTMLDivElement | null);

	function togglePause() {
		pauseShooter(world, !world.paused);
	}

	function restart() {
		restartShooter(world, Date.now());
		recorded = false;
	}

	$effect(() => {
		if (world.over && !recorded) {
			best = writeShooterScore(world.score);
			recorded = true;
		}
	});

	onMount(() => {
		best = readShooterSave();
		const canvas = canvasEl;
		const stage = stageEl;
		if (!canvas || !stage) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const keys = new Set<string>();
		let raf = 0;
		let last = performance.now();
		let pointerAim = false;
		let cancelled = false;

		const colors = () => {
			const css = getComputedStyle(stage);
			return {
				primary: css.getPropertyValue('--qx-primary').trim() || '#3B82F6',
				coral: css.getPropertyValue('--qx-accent-coral').trim() || '#F97316',
				teal: css.getPropertyValue('--qx-accent-teal').trim() || '#14B8A6',
				gold: css.getPropertyValue('--qx-accent-gold').trim() || '#EAB308',
				text: css.getPropertyValue('--qx-text').trim() || '#1f2937',
				card: css.getPropertyValue('--qx-card').trim() || '#ffffff',
				bg: css.getPropertyValue('--qx-bg').trim() || '#eaf3ff',
				dark: document.documentElement.classList.contains('dark')
			};
		};

		const fit = () => {
			const rect = stage.getBoundingClientRect();
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			canvas.width = Math.max(1, Math.floor(rect.width * dpr));
			canvas.height = Math.max(1, Math.floor(rect.height * dpr));
			canvas.style.width = `${rect.width}px`;
			canvas.style.height = `${rect.height}px`;
		};

		const worldFromEvent = (event: PointerEvent) => {
			const rect = canvas.getBoundingClientRect();
			const scale = Math.min(rect.width / WORLD_W, rect.height / WORLD_H);
			const ox = (rect.width - WORLD_W * scale) / 2;
			const oy = (rect.height - WORLD_H * scale) / 2;
			setAim(
				world,
				(event.clientX - rect.left - ox) / (WORLD_W * scale),
				(event.clientY - rect.top - oy) / (WORLD_H * scale)
			);
		};

		const onDown = (event: PointerEvent) => {
			if (event.pointerType === 'mouse' && event.button !== 0) return;
			pointerAim = true;
			stage.setPointerCapture(event.pointerId);
			worldFromEvent(event);
		};
		const onMove = (event: PointerEvent) => {
			if (!pointerAim) return;
			worldFromEvent(event);
		};
		const onUp = () => {
			pointerAim = false;
		};

		const onKeyDown = (event: KeyboardEvent) => {
			const key = event.key.toLowerCase();
			if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
				event.preventDefault();
			}
			keys.add(key);
			if (key === 'p' || key === 'escape') togglePause();
		};
		const onKeyUp = (event: KeyboardEvent) => {
			keys.delete(event.key.toLowerCase());
		};
		const onVis = () => {
			if (document.hidden) pauseShooter(world, true);
		};

		const draw = (now: number) => {
			const c = colors();
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			const viewW = canvas.width / dpr;
			const viewH = canvas.height / dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, viewW, viewH);
			const sky = ctx.createLinearGradient(0, 0, 0, viewH);
			if (c.dark) {
				sky.addColorStop(0, '#15253a');
				sky.addColorStop(1, '#0b1526');
			} else {
				sky.addColorStop(0, '#cfe4ff');
				sky.addColorStop(0.55, '#9ec9ff');
				sky.addColorStop(1, '#e7f6f1');
			}
			ctx.fillStyle = sky;
			ctx.fillRect(0, 0, viewW, viewH);
			const scale = Math.min(viewW / WORLD_W, viewH / WORLD_H);
			const ox = (viewW - WORLD_W * scale) / 2;
			const oy = (viewH - WORLD_H * scale) / 2;
			ctx.save();
			ctx.translate(ox, oy);
			ctx.scale(scale, scale);
			ctx.beginPath();
			ctx.rect(0, 0, WORLD_W, WORLD_H);
			ctx.clip();

			ctx.globalAlpha = 0.35;
			for (let i = 0; i < 5; i++) {
				const y = ((now / 40 + i * 90) % (WORLD_H + 80)) - 40;
				ctx.fillStyle = c.dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)';
				round(ctx, 30 + i * 52, y, 70, 22, 11);
			}
			ctx.globalAlpha = 1;

			for (const wreck of world.obstacles) {
				ctx.fillStyle = c.dark ? '#2a3d5c' : '#64748b';
				ctx.beginPath();
				ctx.moveTo(wreck.x + 4, wreck.y + wreck.h);
				ctx.lineTo(wreck.x, wreck.y + 8);
				ctx.lineTo(wreck.x + wreck.w * 0.45, wreck.y);
				ctx.lineTo(wreck.x + wreck.w, wreck.y + 10);
				ctx.lineTo(wreck.x + wreck.w - 4, wreck.y + wreck.h);
				ctx.closePath();
				ctx.fill();
				ctx.fillStyle = c.coral;
				ctx.fillRect(wreck.x + wreck.w * 0.4, wreck.y + 6, 4, 8);
			}

			for (const enemy of world.enemies) {
				if (enemy.kind === 'scout') {
					ctx.fillStyle = c.teal;
					diamond(ctx, enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.w / 2, enemy.h / 2);
				} else if (enemy.kind === 'fighter') {
					ctx.fillStyle = c.coral;
					ctx.beginPath();
					ctx.moveTo(enemy.x + enemy.w / 2, enemy.y + enemy.h);
					ctx.lineTo(enemy.x, enemy.y);
					ctx.lineTo(enemy.x + enemy.w, enemy.y);
					ctx.closePath();
					ctx.fill();
				} else {
					ctx.fillStyle = c.gold;
					round(ctx, enemy.x, enemy.y, enemy.w, enemy.h, 6);
					ctx.fillStyle = c.dark ? '#0b1526' : '#1f2937';
					ctx.fillRect(enemy.x + 6, enemy.y + 6, enemy.w - 12, 5);
				}
			}

			if (world.boss) {
				const boss = world.boss;
				if (boss.phase === 'telegraph') {
					ctx.strokeStyle = c.gold;
					ctx.lineWidth = 3;
					ctx.globalAlpha = 0.45 + 0.35 * Math.sin(now / 90);
					ctx.beginPath();
					ctx.arc(boss.x + boss.w / 2, boss.y + boss.h / 2, 36 + ((now / 40) % 10), 0, Math.PI * 2);
					ctx.stroke();
					ctx.globalAlpha = 1;
				}
				ctx.fillStyle = c.primary;
				round(ctx, boss.x, boss.y, boss.w, boss.h, 10);
				ctx.fillStyle = c.gold;
				ctx.fillRect(boss.x + 8, boss.y + 10, boss.w - 16, 6);
				ctx.fillStyle = c.coral;
				ctx.fillRect(boss.x - 6, boss.y + 14, 10, 8);
				ctx.fillRect(boss.x + boss.w - 4, boss.y + 14, 10, 8);
			}

			for (const bullet of world.bullets) {
				ctx.fillStyle =
					bullet.from === 'player' ? c.gold : bullet.from === 'boss' ? c.teal : c.coral;
				round(ctx, bullet.x, bullet.y, bullet.w, bullet.h, 2);
			}

			const blink = world.invuln > 0 && Math.floor(now / 80) % 2 === 0;
			if (!blink) {
				const p = world.player;
				ctx.fillStyle = c.primary;
				ctx.beginPath();
				ctx.moveTo(p.x + p.w / 2, p.y);
				ctx.lineTo(p.x + p.w, p.y + p.h);
				ctx.lineTo(p.x + p.w / 2, p.y + p.h - 8);
				ctx.lineTo(p.x, p.y + p.h);
				ctx.closePath();
				ctx.fill();
				ctx.fillStyle = c.gold;
				round(ctx, p.x + p.w / 2 - 4, p.y + 10, 8, 8, 3);
			}

			ctx.fillStyle = c.gold;
			ctx.font = '600 14px Outfit, sans-serif';
			for (const floater of world.floats) {
				ctx.globalAlpha = Math.max(0, floater.life / 40);
				ctx.fillText(floater.text, floater.x, floater.y - (40 - floater.life) * 0.4);
			}
			ctx.globalAlpha = 1;
			ctx.restore();
		};

		const loop = (now: number) => {
			const dt = now - last;
			last = now;
			if (!pointerAim) {
				let ax = world.aimX;
				let ay = world.aimY;
				if (keys.has('arrowleft') || keys.has('a')) ax -= 0.03;
				if (keys.has('arrowright') || keys.has('d')) ax += 0.03;
				if (keys.has('arrowup') || keys.has('w')) ay -= 0.03;
				if (keys.has('arrowdown') || keys.has('s')) ay += 0.03;
				setAim(world, ax, ay);
			}
			if (!world.paused && !world.over && !document.hidden) advance(world, dt);
			draw(now);
			canvas.dataset.ready = '1';
			canvas.dataset.fired = world.shots > 0 ? '1' : '0';
			canvas.dataset.boss = world.boss ? '1' : '0';
			canvas.dataset.lives = String(world.lives);
			canvas.dataset.over = world.over ? '1' : '0';
			raf = requestAnimationFrame(loop);
		};

		fit();
		const ro = new ResizeObserver(fit);
		ro.observe(stage);
		stage.addEventListener('pointerdown', onDown);
		stage.addEventListener('pointermove', onMove);
		stage.addEventListener('pointerup', onUp);
		stage.addEventListener('pointercancel', onUp);
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		document.addEventListener('visibilitychange', onVis);
		raf = requestAnimationFrame(loop);

		return () => {
			cancelled = true;
			cancelAnimationFrame(raf);
			ro.disconnect();
			stage.removeEventListener('pointerdown', onDown);
			stage.removeEventListener('pointermove', onMove);
			stage.removeEventListener('pointerup', onUp);
			stage.removeEventListener('pointercancel', onUp);
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			document.removeEventListener('visibilitychange', onVis);
			void cancelled;
		};
	});

	function round(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number,
		r: number
	) {
		ctx.beginPath();
		ctx.roundRect(x, y, w, h, r);
		ctx.fill();
	}

	function diamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
		ctx.beginPath();
		ctx.moveTo(cx, cy - ry);
		ctx.lineTo(cx + rx, cy);
		ctx.lineTo(cx, cy + ry);
		ctx.lineTo(cx - rx, cy);
		ctx.closePath();
		ctx.fill();
	}
</script>

<svelte:head>
	<title>轻心 · {title}</title>
</svelte:head>

<div class="shooter-play relative h-dvh min-h-0 w-full overflow-hidden bg-[var(--qx-bg)]">
	<div bind:this={stageEl} class="absolute inset-0 touch-none" data-play="sky">
		<canvas bind:this={canvasEl} class="h-full w-full" aria-label="晴空出击"></canvas>
	</div>

	<header
		class="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-3 pt-[max(0.6rem,env(safe-area-inset-top))] md:px-5"
	>
		<a
			href="/modules/games"
			class="{LINK_CLASS} pointer-events-auto shrink-0 bg-[color-mix(in_srgb,var(--qx-card)_88%,transparent)] px-3 backdrop-blur-xl"
		>
			← 返回目录
		</a>
		<h1 class="sr-only">{title}</h1>
		<div class="pointer-events-auto ml-auto flex shrink-0 gap-2">
			<Button variant="secondary" class="px-4" onclick={togglePause} disabled={world.over}>
				{world.paused ? '继续' : '暂停'}
			</Button>
			<Button variant="secondary" class="px-4" onclick={restart}>重新开始</Button>
		</div>
	</header>

	<ul
		class="pointer-events-none absolute inset-x-0 top-16 z-10 mx-auto grid max-w-lg grid-cols-3 gap-2 px-3 md:top-20"
	>
		<li class="stat">{world.score} <span>分数</span></li>
		<li class="stat" data-lives={world.lives}>
			<span class="pips" aria-label="{world.lives} 条命">
				{#each [1, 2, 3] as pip (pip)}
					<i class:on={pip <= world.lives}></i>
				{/each}
			</span>
			<span>生命</span>
		</li>
		<li class="stat">{world.wave} <span>波次</span></li>
	</ul>

	{#if world.boss?.phase === 'telegraph'}
		<p class="banner" data-boss-warn="1">头目来了</p>
	{/if}

	<p class="hint">拖动或用方向键飞。机炮会自己打。</p>
	<p class="best">最好 {best.best}</p>

	{#if world.paused && !world.over}
		<div class="overlay">
			<p class="text-lg font-semibold">先停一下</p>
			<Button class="mt-4" onclick={togglePause}>继续</Button>
		</div>
	{/if}

	{#if world.over}
		<div class="overlay" data-over="1">
			<p class="text-lg font-semibold">结束了</p>
			<p class="mt-2 text-[var(--qx-muted)]">这局 {world.score} · 最好 {best.best}</p>
			<Button class="mt-4" onclick={restart}>再来一局</Button>
		</div>
	{/if}
</div>

<style>
	.stat {
		border-radius: 1rem;
		background: color-mix(in srgb, var(--qx-card) 88%, transparent);
		padding: 0.45rem 0.7rem;
		font-size: 1rem;
		font-weight: 600;
		backdrop-filter: blur(12px);
	}

	.stat span {
		display: block;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--qx-muted);
	}

	.pips {
		display: flex;
		gap: 0.28rem;
		padding: 0.15rem 0;
	}

	.pips i {
		display: block;
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--qx-line) 70%, transparent);
	}

	.pips i.on {
		background: var(--qx-accent-coral);
	}

	.banner {
		position: absolute;
		top: 38%;
		left: 50%;
		z-index: 8;
		transform: translateX(-50%);
		border-radius: 999px;
		background: color-mix(in srgb, var(--qx-accent-gold) 88%, white);
		padding: 0.4rem 1rem;
		font-weight: 600;
		color: var(--qx-text);
	}

	.hint,
	.best {
		position: absolute;
		z-index: 8;
		font-size: 0.8rem;
		color: var(--qx-muted);
		pointer-events: none;
	}

	.hint {
		bottom: max(0.8rem, env(safe-area-inset-bottom));
		left: 0.9rem;
	}

	.best {
		bottom: max(0.8rem, env(safe-area-inset-bottom));
		right: 0.9rem;
	}

	.overlay {
		position: absolute;
		inset: 0;
		z-index: 20;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, var(--qx-bg) 72%, transparent);
		backdrop-filter: blur(8px);
	}

	@media (prefers-reduced-motion: reduce) {
		.banner {
			transform: translateX(-50%);
		}
	}
</style>

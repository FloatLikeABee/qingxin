<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import { dayPhase, phaseLabel, remainingJobSeconds, type SimSpeed } from './day';
	import { FLOORS, standFor, stationById, stationsOn, type Station } from './floors';
	import { followPath, inElevatorZone, interact, setDestination, tryMove } from './input';
	import { remainingTicks, startPerform, tickJob } from './jobs';
	import { readShangbanSave, writeShangbanSave } from './persist';
	import { ROLES, roleById, type FloorId, type RoleId } from './roles';
	import type { ShangbanScene } from './render';
	import {
		beginNextDay,
		callElevator,
		clockLabel,
		closeDay,
		createWorld,
		restartWorld,
		setPaused,
		setRole,
		setSpeed,
		startBreak,
		stepWorld,
		tickWorld,
		type World
	} from './sim';
	import {
		acceptTask,
		AUDIT_RULES,
		chooseDecision,
		choosePart,
		chooseShip,
		declineTask,
		inspectFault,
		judgeClaim,
		moveResource,
		offerPrice,
		PARTS,
		retryTask
	} from './tasks';

	let world = $state<World>(createWorld());
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let stageEl = $state<HTMLDivElement | null>(null);
	let sceneFailed = $state(false);
	let overview = $state(false);
	let roleOpen = $state(false);
	let selected = $state('inbound');
	let fromFloor = $state<FloorId>(3);
	let toFloor = $state<FloorId>(1);
	let pendingWork = $state(false);
	let railOpen = $state(true);
	let pendingRole = $state<RoleId | null>(null);
	let logOpen = $state(false);
	let cadenceMs = $state(16);

	const role = $derived(roleById(world.player.roleId));
	const offered = $derived(
		world.tasks.find((task) => task.status === 'offered' && task.roleId === world.player.roleId)
	);
	const active = $derived(
		world.tasks.find((task) => task.status === 'active' && task.roleId === world.player.roleId)
	);
	const failed = $derived(
		[...world.tasks]
			.reverse()
			.find((task) => task.status === 'failed' && task.roleId === world.player.roleId)
	);
	const floorStations = $derived(stationsOn(world.player.floor));
	const atElevator = $derived(inElevatorZone(world));
	const payload = $derived(active?.payload);
	const dept = $derived(world.company.departments[world.player.floor]);
	const sortDest = $derived.by(() => {
		if (payload?.kind !== 'sort' || !world.player.carrying) return '';
		const box = world.packages.find((item) => item.id === world.player.carrying);
		return box?.dest ?? '';
	});
	const phase = $derived(dayPhase(world.tick));
	const progressPct = $derived(Math.round((active?.progress ?? 0) * 100));
	const requiredLabel = $derived(stationById(active?.requiredStation ?? '')?.label ?? '工位');
	const viewedLog = $derived(world.logs[world.logs.length - 1] ?? null);

	function save() {
		writeShangbanSave(world);
	}

	function paint() {
		const canvas = canvasEl;
		if (!canvas) return;
		canvas.dataset.floor = String(world.player.floor);
		canvas.dataset.role = world.player.roleId;
		canvas.dataset.task = active?.kind ?? offered?.kind ?? '';
		canvas.dataset.npcs = String(world.npcs.length);
		canvas.dataset.pay = String(world.player.pay);
		canvas.dataset.status = active?.status ?? offered?.status ?? '';
		canvas.dataset.dest = sortDest;
		if (stageEl) {
			stageEl.dataset.floor = canvas.dataset.floor;
			stageEl.dataset.role = canvas.dataset.role;
			stageEl.dataset.task = canvas.dataset.task;
			stageEl.dataset.npcs = canvas.dataset.npcs;
			stageEl.dataset.pay = canvas.dataset.pay;
			stageEl.dataset.status = canvas.dataset.status;
			stageEl.dataset.dest = canvas.dataset.dest;
		}
	}

	function beginWork() {
		startPerform(world);
		save();
	}

	function nextDay() {
		beginNextDay(world);
		save();
	}

	function changeSpeed(speed: SimSpeed) {
		setSpeed(world, speed);
		save();
	}

	function goStation(station: Station) {
		selected = station.id;
		if (station.floor !== world.player.floor) {
			world.notice = `先坐电梯去${station.floor}楼。`;
			return;
		}
		const stand = standFor(station);
		setDestination(world, stand.x, stand.z);
		const close = Math.abs(world.player.x - station.x) + Math.abs(world.player.z - station.z) < 1.7;
		if (close) {
			interact(world);
			pendingWork = false;
			save();
		} else {
			pendingWork = station.kind === 'inbound' || station.kind === 'bay';
		}
	}

	function takeOffer() {
		if (!offered) return;
		acceptTask(world, offered.id);
		const home = role
			? stationsOn(role.floor).find((item) => item.roleIds?.includes(role.id))
			: null;
		if (home && home.floor === world.player.floor) goStation(home);
		save();
	}

	function handsOnSort() {
		if (world.player.floor !== 1) {
			world.notice = '先坐电梯去1楼。';
			save();
			return;
		}
		if (world.player.carrying) {
			const box = world.packages.find((item) => item.id === world.player.carrying);
			const bay = stationsOn(1).find((station) => station.bay === box?.dest);
			if (bay) goStation(bay);
			else interact(world);
		} else {
			const inbound = stationById('inbound');
			if (inbound) goStation(inbound);
			else interact(world);
		}
		save();
	}

	function pickRole(id: RoleId) {
		if (active && world.player.roleId !== id) {
			pendingRole = id;
			return;
		}
		setRole(world, id);
		pendingRole = null;
		roleOpen = false;
		save();
	}

	function confirmDropRole() {
		if (!pendingRole) return;
		setRole(world, pendingRole, { dropActive: true });
		pendingRole = null;
		roleOpen = false;
		save();
	}

	function ride(floor: FloorId) {
		callElevator(world, floor);
		save();
	}

	function togglePause() {
		setPaused(world, !world.paused);
	}

	function restart() {
		restartWorld(world, Date.now());
		save();
	}

	onMount(() => {
		world = readShangbanSave();
		paint();
		let scene: ShangbanScene | null = null;
		let raf = 0;
		let last = performance.now();
		const keys = new Set<string>();
		const canvas = canvasEl;
		const stage = stageEl;
		if (!canvas || !stage) return;
		let cancelled = false;
		let resizeObserver: ResizeObserver | undefined;
		let dragging = false;
		let moved = false;
		let lastX = 0;

		const onKey = (event: KeyboardEvent) => {
			if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
				return;
			keys.add(event.key);
			if (event.key === ' ' || event.key === 'Spacebar') {
				event.preventDefault();
				togglePause();
			}
			if (event.key === 'e' || event.key === 'E') interact(world);
			if (event.key === 'b' || event.key === 'B') startBreak(world);
			if (event.key === 'r' || event.key === 'R') roleOpen = !roleOpen;
			if (event.key === 'o' || event.key === 'O') overview = !overview;
			if (event.key >= '1' && event.key <= '5') ride(Number(event.key) as FloorId);
		};
		const onUp = (event: KeyboardEvent) => keys.delete(event.key);
		window.addEventListener('keydown', onKey);
		window.addEventListener('keyup', onUp);
		const onVis = () => {
			world.hidden = document.hidden;
		};
		document.addEventListener('visibilitychange', onVis);

		const drop: Array<() => void> = [];
		void (async () => {
			const { mountShangbanScene } = await import('./render');
			if (cancelled) return;
			try {
				scene = mountShangbanScene(canvas);
			} catch {
				scene = null;
			}
			if (!scene) {
				sceneFailed = true;
				canvas.dataset.ready = '0';
			} else {
				scene.resize();
				canvas.dataset.ready = '1';
				const onResize = () => scene?.resize();
				resizeObserver = new ResizeObserver(onResize);
				resizeObserver.observe(stage);
				window.addEventListener('resize', onResize);

				const onDown = (event: PointerEvent) => {
					if (event.pointerType === 'mouse' && event.button !== 0) return;
					dragging = true;
					moved = false;
					lastX = event.clientX;
					stage.setPointerCapture(event.pointerId);
				};
				const onMove = (event: PointerEvent) => {
					if (!dragging) return;
					const dx = event.clientX - lastX;
					if (Math.abs(dx) > 4) moved = true;
					lastX = event.clientX;
					scene?.orbit(dx);
				};
				const onPointerUp = (event: PointerEvent) => {
					if (!dragging) return;
					dragging = false;
					if (moved) return;
					const id = scene?.pick(event.clientX, event.clientY);
					if (id) {
						const station = stationById(id);
						if (station) goStation(station);
					}
				};
				stage.addEventListener('pointerdown', onDown);
				stage.addEventListener('pointermove', onMove);
				stage.addEventListener('pointerup', onPointerUp);
				stage.addEventListener('pointercancel', onPointerUp);
				drop.push(() => {
					window.removeEventListener('resize', onResize);
					stage.removeEventListener('pointerdown', onDown);
					stage.removeEventListener('pointermove', onMove);
					stage.removeEventListener('pointerup', onPointerUp);
					stage.removeEventListener('pointercancel', onPointerUp);
				});
			}

			const loop = (now: number) => {
				const dt = Math.min(0.05, (now - last) / 1000);
				cadenceMs = now - last || cadenceMs;
				last = now;
				if (!document.hidden) {
					world.hidden = false;
					let mx = 0;
					let mz = 0;
					if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) mx -= 1;
					if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) mx += 1;
					if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) mz -= 1;
					if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) mz += 1;
					if (mx || mz) tryMove(world, mx, mz, 0.2);
					else followPath(world);
					if (pendingWork && world.player.path.length === 0) {
						interact(world);
						pendingWork = false;
						save();
					}
					stepWorld(world, dt * 1000);
				} else {
					world.hidden = true;
				}
				paint();
				scene?.sync(world, selected, overview);
				scene?.render(now);
				raf = requestAnimationFrame(loop);
			};
			raf = requestAnimationFrame(loop);

			if (cancelled) {
				cancelAnimationFrame(raf);
				scene?.dispose();
			}
		})();

		const interval = setInterval(save, 4000);
		if (
			typeof window !== 'undefined' &&
			(window as Window & { __qingxinE2E?: boolean }).__qingxinE2E
		) {
			(
				window as Window & {
					__qingxinShangban?: {
						getState: () => World;
						tick: (n: number) => void;
						closeNow: () => void;
						advanceJob: (n: number) => void;
					};
				}
			).__qingxinShangban = {
				getState: () => world,
				tick: (n: number) => {
					const count = Math.max(0, Math.min(40, Math.floor(n)));
					for (let i = 0; i < count; i++) tickWorld(world);
					save();
					paint();
				},
				closeNow: () => {
					try {
						world.paused = false;
						world.hidden = false;
						closeDay(world);
						save();
					} catch (error) {
						world.notice = error instanceof Error ? error.message : '收工失败';
					}
				},
				advanceJob: (n: number) => {
					const count = Math.max(0, Math.min(400, Math.floor(n)));
					for (let i = 0; i < count; i++) tickJob(world);
					save();
					paint();
				}
			};
		}

		return () => {
			cancelled = true;
			cancelAnimationFrame(raf);
			clearInterval(interval);
			resizeObserver?.disconnect();
			for (const fn of drop) fn();
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('keyup', onUp);
			document.removeEventListener('visibilitychange', onVis);
			scene?.dispose();
			save();
		};
	});
</script>

<svelte:head>
	<title>轻心 · 上班</title>
</svelte:head>

<div
	class="play"
	data-shangban="1"
	data-floor={world.player.floor}
	data-role={world.player.roleId}
	data-task={active?.kind ?? offered?.kind ?? ''}
	data-npcs={world.npcs.length}
	data-pay={world.player.pay}
	data-status={active?.status ?? offered?.status ?? ''}
	data-stage={active?.stage ?? offered?.stage ?? ''}
	data-progress={String(progressPct)}
	data-day={world.day}
	data-phase={phase}
	data-rail={railOpen ? 'open' : 'collapsed'}
	data-closed={world.dayClosed ? '1' : '0'}
	data-dest={sortDest}
	data-elevator={atElevator ? '1' : '0'}
	data-path={world.player.path.length}
	data-carry={world.player.carrying ?? ''}
	data-cadence={cadenceMs.toFixed(1)}
>
	<header class="top qx-glass">
		<a href="/modules" class="{LINK_CLASS} shrink-0">← 返回模块</a>
		<h1 class="sr-only">上班</h1>
		<ul class="stats" aria-label="公司和自己">
			<li><b>D{world.day} {clockLabel(world.tick)}</b><span>{phaseLabel(phase)}</span></li>
			<li><b>¥{world.player.pay}</b><span>薪水</span></li>
			<li><b>{world.player.reputation}</b><span>口碑</span></li>
			<li><b>{dept.workload}</b><span>{world.player.floor}楼负荷</span></li>
		</ul>
		<div class="top-actions">
			<Button variant="ghost" class="rail-toggle px-3" onclick={() => (railOpen = !railOpen)}>
				{railOpen ? '收起操作' : '打开操作'}
			</Button>
			<Button variant="secondary" class="px-4" onclick={togglePause} disabled={world.dayClosed}>
				{world.paused ? '继续' : '暂停'}
			</Button>
			<Button variant="secondary" class="px-4" onclick={restart}>重新开始</Button>
		</div>
	</header>

	<div class="body">
		<div bind:this={stageEl} class="stage" data-play="shangban">
			<canvas bind:this={canvasEl} class="h-full w-full" aria-label="轻心大厦"></canvas>
			{#if sceneFailed}
				<p class="fail">这台设备画不出大厦。工位和任务按钮仍可用。</p>
			{/if}
		</div>

		<section class="dock qx-glass" aria-label="办公" data-shangban-dock>
			<p class="notice" aria-live="polite">{world.notice}</p>
			<p class="meta">
				{role?.name} · {role?.department} · 现金 ¥{world.company.cash} · 士气 {world.company.morale}
			</p>
			<div class="row speed" aria-label="倍速">
				{#each [1, 2, 3] as rate (rate)}
					<button
						type="button"
						class="chip {world.speed === rate ? 'on' : ''}"
						onclick={() => changeSpeed(rate as SimSpeed)}
					>
						{rate}x
					</button>
				{/each}
			</div>
			<p class="meta keys">WASD 走动 · 1-5 楼 · E 动手 · 空格暂停 · R 换岗 · B 休息 · O 俯瞰</p>
			<p class="sr-only">
				方向键或 WASD 走动。数字 1 到 5 乘电梯。E 在工位动手。空格暂停。R 打开换岗。B 休息。O
				俯瞰大厦。
			</p>

			{#if atElevator}
				<div class="row" aria-label="电梯">
					{#each FLOORS as floor (floor.id)}
						<button
							type="button"
							class="chip {world.player.floor === floor.id ? 'on' : ''}"
							onclick={() => ride(floor.id)}
						>
							{floor.id}F {floor.name}
						</button>
					{/each}
				</div>
			{/if}

			{#if offered && !active}
				<div class="row">
					<Button class="min-h-12 min-w-28" onclick={takeOffer}>接这单</Button>
					<Button variant="secondary" onclick={() => (declineTask(world, offered.id), save())}
						>推掉</Button
					>
					<span class="hint">{offered.title}。{offered.detail}</span>
				</div>
			{/if}

			{#if active}
				<div class="job" data-shangban-job>
					<p class="hint">
						{active.stage === 'prepare'
							? `先到${requiredLabel}开始。`
							: active.stage === 'submit'
								? '可以提交了。'
								: `在${requiredLabel}做，走开会暂停进度。`}
					</p>
					<label class="progress-label" for="shangban-progress">进度 {progressPct}%</label>
					<progress
						id="shangban-progress"
						max="100"
						value={progressPct}
						data-shangban-progress={progressPct}
					></progress>
					<p class="meta">
						还剩约 {remainingJobSeconds(remainingTicks(active), world.speed).toFixed(1)} 秒 · {active.checkpoints
							.filter((item) => !item.done)
							.map((item) => item.label)
							.join(' · ') || '检查点齐了'}
					</p>
					{#if active.stage === 'prepare'}
						<Button class="min-h-12" onclick={beginWork}>开始干活</Button>
					{/if}
				</div>
			{/if}

			{#if payload?.kind === 'sort'}
				<p class="hint">到货口提起，送到字母相同的口。点场景里的口或按 E。</p>
				<Button class="min-h-12" onclick={handsOnSort}>提起 / 放下</Button>
			{/if}

			{#if payload?.kind === 'negotiate'}
				<p class="hint">{payload.product} · 耐心 {payload.patience}</p>
				<div class="row">
					<Button onclick={() => (offerPrice(world, 'high'), save())}>高价</Button>
					<Button onclick={() => (offerPrice(world, 'fair'), save())}>公道</Button>
					<Button variant="secondary" onclick={() => (offerPrice(world, 'low'), save())}
						>让价</Button
					>
				</div>
			{/if}

			{#if payload?.kind === 'repair'}
				<p class="hint">{payload.device} · {payload.clue ?? payload.symptoms.join('，')}</p>
				<div class="row">
					<Button variant="secondary" onclick={() => (inspectFault(world), save())}>检查</Button>
					{#each PARTS as part (part)}
						<Button onclick={() => (choosePart(world, part), save())}>{part}</Button>
					{/each}
				</div>
			{/if}

			{#if payload?.kind === 'ship'}
				<p class="hint">{payload.ticket} · {payload.severity === 'high' ? '高' : '低'}严重度</p>
				<div class="row">
					<Button onclick={() => (chooseShip(world, 'test'), save())}>写测试</Button>
					<Button onclick={() => (chooseShip(world, 'ship'), save())}>直接上线</Button>
					<Button variant="secondary" onclick={() => (chooseShip(world, 'rewrite'), save())}
						>重写</Button
					>
				</div>
			{/if}

			{#if payload?.kind === 'audit'}
				<p class="hint">
					{payload.category} ¥{payload.amount} · {payload.hasReceipt ? '有票据' : '无票据'}
					{payload.flagged ? ' · 已审批' : ''}
					· 餐补≤¥{AUDIT_RULES.mealMax}，加班要旗，无票据必驳
				</p>
				<div class="row">
					<Button onclick={() => (judgeClaim(world, 'approve'), save())}>通过</Button>
					<Button variant="secondary" onclick={() => (judgeClaim(world, 'reject'), save())}
						>驳回</Button
					>
				</div>
			{/if}

			{#if payload?.kind === 'allocate'}
				<p class="hint">编制不能抽空。数字立刻会变。</p>
				<div class="row">
					{#each FLOORS as floor (floor.id)}
						<button
							type="button"
							class="chip {fromFloor === floor.id ? 'on' : ''}"
							onclick={() => (fromFloor = floor.id)}
						>
							从{floor.id}F {world.company.departments[floor.id].staff}人/{world.company
								.departments[floor.id].workload}
						</button>
					{/each}
				</div>
				<div class="row">
					{#each FLOORS as floor (floor.id)}
						<button
							type="button"
							class="chip {toFloor === floor.id ? 'on' : ''}"
							onclick={() => (toFloor = floor.id)}
						>
							到{floor.id}F
						</button>
					{/each}
				</div>
				<div class="row">
					<Button onclick={() => (moveResource(world, fromFloor, toFloor, 'staff'), save())}
						>调 1 人</Button
					>
					<Button
						variant="secondary"
						onclick={() => (moveResource(world, fromFloor, toFloor, 'budget'), save())}
						>调预算</Button
					>
				</div>
			{/if}

			{#if payload?.kind === 'decide'}
				<div class="row">
					{#each payload.options as option (option.id)}
						<Button onclick={() => (chooseDecision(world, option.id), save())}
							>{option.label}</Button
						>
					{/each}
				</div>
			{/if}

			{#if failed && !active}
				<Button variant="secondary" onclick={() => (retryTask(world, failed.id), save())}
					>重试</Button
				>
			{/if}

			<div class="row">
				{#each floorStations as station (station.id)}
					<button
						type="button"
						class="chip {selected === station.id ? 'on' : ''}"
						onclick={() => goStation(station)}
					>
						{station.label}
					</button>
				{/each}
				<Button variant="secondary" onclick={() => (roleOpen = true)}>换岗</Button>
				<Button variant="ghost" onclick={() => startBreak(world)}>休息</Button>
				<Button variant="ghost" onclick={() => (overview = !overview)}
					>{overview ? '回到工位' : '俯瞰'}</Button
				>
				<Button variant="ghost" onclick={() => (logOpen = !logOpen)}>日志</Button>
			</div>

			{#if logOpen || world.logs.length > 0}
				<div class="log" data-shangban-log>
					<p class="hint">每日日志（留 {world.logs.length} 天）</p>
					{#each [...world.logs].reverse() as entry (entry.day)}
						<article class="log-card">
							<h3>第{entry.day}天 · {entry.closedClock} · ¥{entry.payEarned}</h3>
							<ul>
								{#each entry.tasks as row, i (`${entry.day}-task-${i}`)}
									<li>{row.title} · {row.status} · {row.ticksSpent}拍 · ¥{row.pay}</li>
								{/each}
								{#each entry.events as note, i (`${entry.day}-event-${i}`)}
									<li>{note}</li>
								{/each}
								{#each entry.unfinished as row, i (`${entry.day}-open-${i}`)}
									<li>未完成 {row.title} · {row.stage} {Math.round(row.progress * 100)}%</li>
								{/each}
							</ul>
						</article>
					{/each}
					{#if viewedLog && world.logs.length === 0}
						<p class="meta">还没有收过工。</p>
					{/if}
				</div>
			{/if}
		</section>
	</div>

	{#if roleOpen}
		<div class="overlay" role="dialog" aria-label="换岗">
			<article class="sheet qx-glass">
				<h2 class="font-[Outfit] text-2xl font-semibold">换岗</h2>
				<p class="mt-2 text-sm text-[var(--qx-muted)]">
					随时可换，不用攒等级。去对应楼层做那种活。
				</p>
				<div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
					{#each ROLES as item (item.id)}
						<button
							type="button"
							class="role {world.player.roleId === item.id ? 'on' : ''}"
							onclick={() => pickRole(item.id)}
						>
							<b>{item.name}</b>
							<span>{item.floor}F {item.department}</span>
							<span>{item.blurb}</span>
						</button>
					{/each}
				</div>
				<Button class="mt-4" variant="secondary" onclick={() => (roleOpen = false)}>关上</Button>
			</article>
		</div>
	{/if}

	{#if pendingRole}
		<div class="overlay" role="dialog" aria-label="放下这单">
			<article class="sheet qx-glass">
				<h2 class="font-[Outfit] text-2xl font-semibold">手头的活还没交</h2>
				<p class="mt-2 text-sm text-[var(--qx-muted)]">放下没有薪水。做完再换岗也不会丢进度。</p>
				<div class="row mt-4">
					<Button onclick={confirmDropRole}>放下这单</Button>
					<Button variant="secondary" onclick={() => (pendingRole = null)}>先做完</Button>
				</div>
			</article>
		</div>
	{/if}

	{#if world.dayClosed}
		<div class="overlay" role="dialog" aria-label="收工">
			<article class="sheet qx-glass" data-shangban-close>
				<h2 class="font-[Outfit] text-2xl font-semibold">第{world.day}天收工</h2>
				<p class="mt-2">
					今日薪水 ¥{viewedLog?.payEarned ?? 0}。未完成的活会带到下一天。
				</p>
				{#if viewedLog?.unfinished?.length}
					<p class="meta">未完成：{viewedLog.unfinished.map((row) => row.title).join('，')}</p>
				{/if}
				<Button class="mt-4" onclick={nextDay}>下一天</Button>
			</article>
		</div>
	{/if}

	{#if world.paused && !world.hidden && !world.dayClosed}
		<div class="overlay">
			<p class="font-[Outfit] text-2xl font-semibold">暂停</p>
			<p class="mt-2 text-[var(--qx-muted)]">大厦还在，指针停住。</p>
			<Button class="mt-5" onclick={togglePause}>继续</Button>
		</div>
	{/if}

	{#if sceneFailed}
		<div class="fallback" aria-label="工位列表">
			{#each FLOORS as floor (floor.id)}
				<button type="button" class="chip" onclick={() => ride(floor.id)}>{floor.name}</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.play {
		position: relative;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		height: 100dvh;
		min-height: 0;
		overflow: hidden;
		background: var(--qx-bg);
	}

	.body {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(16.5rem, 1fr);
		gap: 0.45rem;
		min-height: 0;
		padding: 0 0.55rem max(0.45rem, env(safe-area-inset-bottom));
	}

	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem 0.5rem;
		margin: 0.4rem 0.65rem 0;
		padding: 0.4rem 0.55rem;
		padding-top: max(0.4rem, env(safe-area-inset-top));
		border-radius: 1.15rem;
		z-index: 10;
	}

	.stats {
		display: flex;
		flex: 1;
		justify-content: space-evenly;
		gap: 0.35rem;
		min-width: 0;
		font-family: Outfit, var(--font-sans);
		font-size: 0.95rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.stats li {
		display: flex;
		flex-direction: column;
		align-items: center;
		white-space: nowrap;
		line-height: 1.15;
	}

	.stats span {
		font-family: var(--font-sans);
		font-size: 0.62rem;
		font-weight: 400;
		color: var(--qx-muted);
	}

	.top-actions {
		display: flex;
		flex-shrink: 0;
		gap: 0.35rem;
	}

	.stage {
		position: relative;
		min-height: 0;
		min-width: 0;
		touch-action: none;
		border-radius: 1.15rem;
		overflow: hidden;
	}

	.fail {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		text-align: center;
		color: var(--qx-muted);
	}

	.dock {
		min-height: 0;
		margin: 0;
		padding: 0.7rem 0.75rem 0.75rem;
		border-radius: 1.35rem;
		z-index: 10;
		overflow: auto;
		overscroll-behavior: contain;
	}

	.job progress {
		display: block;
		width: 100%;
		height: 0.7rem;
		margin: 0.25rem 0 0.35rem;
	}

	.progress-label {
		font-size: 0.78rem;
		color: var(--qx-muted);
	}

	.log-card {
		margin-top: 0.45rem;
		padding: 0.45rem 0.5rem;
		border-radius: 0.85rem;
		background: color-mix(in oklab, var(--qx-surface) 55%, transparent);
	}

	.log-card h3 {
		margin: 0 0 0.25rem;
		font-size: 0.92rem;
	}

	.log-card ul {
		margin: 0;
		padding-left: 1.1rem;
		font-size: 0.8rem;
		color: var(--qx-muted);
	}

	.notice {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.meta,
	.hint {
		margin: 0.2rem 0 0.45rem;
		font-size: 0.82rem;
		color: var(--qx-muted);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 0.45rem;
		align-items: center;
	}

	.chip,
	.role {
		min-height: 44px;
		border-radius: 1rem;
		padding: 0.45rem 0.75rem;
		text-align: left;
		background: color-mix(in oklab, var(--qx-surface) 70%, transparent);
		border: 1px solid color-mix(in oklab, white 28%, var(--qx-line));
		color: var(--qx-text);
	}

	.chip:focus-visible,
	.role:focus-visible {
		outline: 2px solid var(--qx-primary);
		outline-offset: 2px;
	}

	@supports not (background: color-mix(in oklab, white 10%, black)) {
		.chip,
		.role {
			background: var(--qx-card);
		}
	}

	.chip.on,
	.role.on {
		box-shadow: 0 0 0 2px var(--qx-primary);
		background: var(--qx-card);
	}

	.role {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.role span {
		font-size: 0.8rem;
		color: var(--qx-muted);
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
		padding: 1rem;
		text-align: center;
	}

	.sheet {
		width: min(32rem, 100%);
		max-height: 80dvh;
		overflow: auto;
		padding: 1.1rem;
		border-radius: 1.4rem;
		text-align: left;
	}

	.fallback {
		position: absolute;
		inset: auto 0.65rem 8rem;
		z-index: 12;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	@media (max-width: 899px) {
		.body {
			grid-template-columns: 1fr;
			grid-template-rows: minmax(0, 1fr) auto;
		}

		.dock {
			max-height: 38dvh;
		}

		.play[data-rail='collapsed'] .dock {
			max-height: 0;
			padding-top: 0;
			padding-bottom: 0;
			margin: 0;
			overflow: hidden;
			border-width: 0;
		}
	}

	@media (max-width: 430px) {
		.stats {
			flex: 1 1 100%;
			order: 3;
			justify-content: space-between;
			font-size: 0.9rem;
			padding-top: 0.2rem;
		}

		.top-actions :global(button) {
			min-width: 0;
			padding-inline: 0.65rem;
		}
	}

	@media (orientation: landscape) and (max-height: 520px) {
		.body {
			grid-template-columns: minmax(0, 3fr) minmax(14rem, 1fr);
			grid-template-rows: minmax(0, 1fr);
		}

		.dock {
			max-height: none;
		}

		.play[data-rail='collapsed'] .dock {
			max-height: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.chip,
		.role {
			transition: none;
		}
	}
</style>

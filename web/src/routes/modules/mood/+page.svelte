<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { getApi } from '#lib/api/client';
	import type { MeditationStory, MoodInsight } from '#lib/api/types';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import Tabs from '#lib/components/Tabs.svelte';
	import Tag from '#lib/components/Tag.svelte';
	import Textarea from '#lib/components/Textarea.svelte';
	import { MOOD_EMOJIS, MOOD_TAGS, SOUND_PRESETS } from '#lib/mood/catalog';
	import { breathePhase, breatheScale, CYCLE_SECONDS } from '#lib/mood/breathe';
	import { chunkInsight, DISCLAIMER } from '#lib/mood/insight';
	import { HOTLINE_NAME, HOTLINE_NUMBER, hotlineHref } from '#lib/mood/hotline';
	import { NoiseMixer } from '#lib/mood/noise';
	import { cacheLogs, cacheSessions, loadCachedLogs, saveCheckIn, saveMeditationSession } from '#lib/mood/store';
	import TrendChart from '#lib/mood/TrendChart.svelte';
	import type { MoodLog, TrendPoint } from '#lib/mood/trends';
	import { validateCheckIn } from '#lib/mood/validate';
	import { pushToast } from '#lib/toast';

	let tab = $state(0);
	let emoji = $state('');
	let tags = $state<string[]>([]);
	let note = $state('');
	let logs = $state<MoodLog[]>([]);
	let points = $state<TrendPoint[]>([]);
	let period = $state<'week' | 'month'>('week');
	let filterTag = $state('');
	let insightText = $state('');
	let insightFull = $state<MoodInsight | null>(null);
	let summary = $state<MoodInsight>({
		text: '这个月还没有足够的记录。先写下今天的一笔就好。',
		disclaimer: DISCLAIMER,
		source: 'mock'
	});
	let stories = $state<MeditationStory[]>([]);
	let story = $state<MeditationStory | null>(null);
	let storyOpen = $state(false);
	let overlay = $state<'breathe' | 'timer' | 'mixer' | null>(null);
	let hotlineOpen = $state(false);
	let pending = $state(false);
	let needLogin = $state(false);
	let breathLabel = $state('吸气');
	let breathScale = $state(0.72);
	let timerLeft = $state(180);
	let timerTotal = $state(180);
	let timerRunning = $state(false);
	let levels = $state<Record<string, number>>({
		rain: 0.4,
		waves: 0,
		fan: 0,
		fire: 0,
		white: 0.15
	});
	let mixerOn = $state(false);

	const mixer = new NoiseMixer();
	let breathTimer: number | undefined;
	let clockTimer: number | undefined;
	let typeTimer: number | undefined;
	let breathStarted = 0;

	const noteCount = $derived([...note].length);
	const monthKey = $derived(new Date().toISOString().slice(0, 7));

	onMount(() => {
		void boot();
		return () => {
			void mixer.stop();
			window.clearInterval(breathTimer);
			window.clearInterval(clockTimer);
			window.clearInterval(typeTimer);
		};
	});

	onDestroy(() => {
		void mixer.stop();
	});

	async function boot() {
		const session = await getApi().getSession();
		if (!session) {
			needLogin = true;
			return;
		}
		needLogin = false;
		let listed: MoodLog[] = [];
		try {
			listed = await getApi().listMoodLogs();
		} catch {
			listed = [];
		}
		const cached = await loadCachedLogs();
		const nextLogs = listed.length ? listed : cached;
		try {
			if (nextLogs.length) await cacheLogs(nextLogs);
		} catch {
			/* insight and list still work without a cache write */
		}
		logs = nextLogs;
		try {
			summary = await getApi().getMonthlyMoodSummary(monthKey);
		} catch {
			summary = { ...summary, month: monthKey };
		}
		if (logs[0]) {
			try {
				await revealInsight(await getApi().createMoodInsight({ moodLogId: logs[0].id }));
			} catch {
				/* keep the page usable */
			}
		}
		await refreshTrends();
		try {
			const catalog = await getApi().getMeditationCatalog();
			stories = catalog.stories;
			await cacheSessions(await getApi().listMeditationSessions());
		} catch {
			/* catalog stays empty offline */
		}
	}

	async function refreshTrends() {
		const trends = await getApi().getMoodTrends(period, filterTag || undefined);
		points = trends.points;
	}

	function toggleTag(tag: string) {
		tags = tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag];
	}

	async function submitCheckIn() {
		const checked = validateCheckIn({ emoji, tags, note });
		if (!checked.ok) {
			pushToast({ title: checked.message, tone: 'danger' });
			return;
		}
		pending = true;
		const previous = logs;
		let saved;
		try {
			saved = await saveCheckIn(
				{ emoji: checked.value.emoji, tags: checked.value.tags, note: checked.value.note ?? undefined },
				(log) => {
					logs = [log, ...logs];
				},
				() => {
					logs = previous;
				}
			);
		} catch {
			pushToast({ title: '没能记下，请再试一次', tone: 'danger' });
			pending = false;
			return;
		}
		logs = [saved, ...previous.filter((item) => item.id !== saved.id)];
		await cacheLogs(logs);
		try {
			await revealInsight(await getApi().createMoodInsight({ moodLogId: saved.id }));
			await refreshTrends();
			summary = await getApi().getMonthlyMoodSummary(monthKey);
		} catch {
			/* the check-in is already saved */
		}
		pushToast({
			title: typeof navigator !== 'undefined' && !navigator.onLine ? '先存在本地，网络恢复后会同步' : '已记下这一刻',
			tone: 'success'
		});
		note = '';
		pending = false;
	}

	function revealInsight(insight: MoodInsight) {
		insightFull = insight;
		const reduce =
			typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const chunks = chunkInsight(insight.text, 2, reduce);
		window.clearInterval(typeTimer);
		if (chunks.length <= 1) {
			insightText = insight.text;
			return;
		}
		let index = 0;
		insightText = chunks[0] ?? '';
		typeTimer = window.setInterval(() => {
			index += 1;
			insightText = chunks[index] ?? insight.text;
			if (index >= chunks.length - 1) window.clearInterval(typeTimer);
		}, 28);
	}

	function prefersReducedMotion() {
		return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function openBreath() {
		overlay = 'breathe';
		breathStarted = performance.now();
		window.clearInterval(breathTimer);
		breathTimer = window.setInterval(() => {
			const elapsed = (performance.now() - breathStarted) / 1000;
			const phase = breathePhase(elapsed);
			breathLabel = phase.label;
			breathScale = breatheScale(phase, prefersReducedMotion());
		}, 80);
	}

	async function closeOverlay() {
		const kind = overlay;
		if (kind === 'breathe') {
			window.clearInterval(breathTimer);
			const seconds = Math.round((performance.now() - breathStarted) / 1000);
			try {
				await saveMeditationSession({
					kind: 'breathe',
					durationSec: seconds,
					payload: { cycles: Math.floor(seconds / CYCLE_SECONDS) }
				});
			} catch {
				/* keep the overlay closable */
			}
		}
		if (kind === 'timer') {
			window.clearInterval(clockTimer);
			const elapsed = timerTotal - timerLeft;
			timerRunning = false;
			try {
				await saveMeditationSession({
					kind: 'timer',
					durationSec: elapsed,
					payload: { preset: timerTotal }
				});
			} catch {
				/* keep the overlay closable */
			}
		}
		if (kind === 'mixer') {
			const seconds = Math.round((performance.now() - breathStarted) / 1000);
			await mixer.stop();
			mixerOn = false;
			try {
				await saveMeditationSession({
					kind: 'noise',
					durationSec: seconds,
					payload: { levels: { ...levels } }
				});
			} catch {
				/* keep the overlay closable */
			}
		}
		overlay = null;
	}

	async function startMixer() {
		await mixer.start(SOUND_PRESETS);
		mixerOn = true;
		for (const [id, value] of Object.entries(levels)) mixer.setLevel(id, value);
	}

	function setLevel(id: string, value: number) {
		levels = { ...levels, [id]: value };
		mixer.setLevel(id, value);
	}

	function startTimer(seconds: number) {
		overlay = 'timer';
		timerTotal = seconds;
		timerLeft = seconds;
		timerRunning = true;
		window.clearInterval(clockTimer);
		clockTimer = window.setInterval(() => {
			if (!timerRunning) return;
			timerLeft = Math.max(0, timerLeft - 1);
			if (timerLeft === 0) {
				timerRunning = false;
				window.clearInterval(clockTimer);
			}
		}, 1000);
	}

	function openStory(item: MeditationStory | null) {
		story = item;
		storyOpen = Boolean(item);
	}

	function confirmHotline() {
		hotlineOpen = false;
		window.location.href = hotlineHref();
	}

	function formatClock(total: number) {
		const minutes = Math.floor(total / 60)
			.toString()
			.padStart(2, '0');
		const seconds = Math.floor(total % 60)
			.toString()
			.padStart(2, '0');
		return `${minutes}:${seconds}`;
	}

	$effect(() => {
		void period;
		void filterTag;
		if (!needLogin) void refreshTrends();
	});
</script>

<svelte:head>
	<title>轻心 · 情绪日记+冥想</title>
</svelte:head>

<section class="qx-mood mx-auto max-w-2xl space-y-5">
	<a href="/modules" class="inline-flex min-h-11 items-center text-base text-[var(--qx-muted)]">← 返回模块中心</a>
	<div class="flex items-start justify-between gap-4">
		<div>
			<Tag tone="primary">示意陪伴 · 非医疗</Tag>
			<h1 class="mt-3 font-[Outfit] text-3xl font-semibold tracking-tight">情绪日记</h1>
			<p class="mt-2 text-base text-[var(--qx-muted)]">用一枚表情、几片标签，把今天轻轻放下。</p>
		</div>
		<Button variant="ghost" class="min-h-11 shrink-0" onclick={() => (hotlineOpen = true)}
			>心理援助热线 12356</Button
		>
	</div>

	<Tabs bind:value={tab} tabs={['日记', '趋势', '冥想']} />

	{#if needLogin}
		<Card>
			<EmptyState title="先登录再写下今天" body="演示账号已填好。记录只属于你，备注会加密保存。" icon="cloud">
				{#snippet action()}
					<Button href="/login">去登录</Button>
				{/snippet}
			</EmptyState>
		</Card>
	{:else if tab === 0}
		<Card class="space-y-5 shadow-[0_0_80px_var(--qx-glow)]">
			<div>
				<p class="text-base font-medium">此刻的心情</p>
				<div class="mt-3 grid grid-cols-4 gap-2 md:grid-cols-8">
					{#each MOOD_EMOJIS as face (face.glyph)}
						<button
							type="button"
							class="flex min-h-14 flex-col items-center justify-center rounded-2xl text-2xl transition {emoji ===
							face.glyph
								? 'bg-[color-mix(in_srgb,var(--qx-primary)_16%,transparent)] ring-2 ring-[var(--qx-primary)]'
								: 'bg-[var(--qx-surface)]'}"
							aria-pressed={emoji === face.glyph}
							onclick={() => (emoji = face.glyph)}
						>
							<span>{face.glyph}</span>
							<span class="text-xs text-[var(--qx-muted)]">{face.label}</span>
						</button>
					{/each}
				</div>
			</div>
			<div>
				<p class="text-base font-medium">标签云</p>
				<div class="mt-3 flex flex-wrap gap-2">
					{#each MOOD_TAGS as tag (tag)}
						<button
							type="button"
							class="min-h-11 rounded-full px-4 text-base {tags.includes(tag)
								? 'bg-[var(--qx-primary)] text-white'
								: 'bg-[var(--qx-surface)] text-[var(--qx-muted)]'}"
							onclick={() => toggleTag(tag)}
						>
							{tag}
						</button>
					{/each}
				</div>
			</div>
			<Textarea label="一句备注（选填）" bind:value={note} maxlength={99} placeholder="少于 100 字即可" />
			<p class="text-right text-sm text-[var(--qx-muted)]">{noteCount}/99</p>
			<Button class="w-full" disabled={pending || !emoji} onclick={submitCheckIn}>记下这一刻</Button>
		</Card>

		{#if insightFull}
			<Card class="space-y-3">
				<Tag tone="warm">示意洞察</Tag>
				<p class="text-lg leading-8">{insightText}</p>
				<p class="text-sm text-[var(--qx-muted)]">{insightFull.disclaimer}</p>
			</Card>
		{/if}

		<div class="space-y-3">
			<h2 class="text-lg font-semibold">最近</h2>
			{#each logs.slice(0, 6) as log (log.id)}
				<Card class="flex items-start gap-3">
					<span class="text-3xl">{log.emoji}</span>
					<div>
						<p class="text-base">{log.note ?? '没有写字，也算一笔。'}</p>
						<p class="mt-1 text-sm text-[var(--qx-muted)]">
							{log.tags.join(' · ') || '未分类'} · {log.createdAt.slice(0, 10)}
						</p>
					</div>
				</Card>
			{/each}
		</div>
	{:else if tab === 1}
		<Card class="space-y-4">
			<div class="flex gap-2">
				<Button variant={period === 'week' ? 'primary' : 'secondary'} onclick={() => (period = 'week')}>本周</Button>
				<Button variant={period === 'month' ? 'primary' : 'secondary'} onclick={() => (period = 'month')}
					>本月</Button
				>
			</div>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					class="min-h-11 rounded-full px-4 {filterTag === ''
						? 'bg-[var(--qx-primary)] text-white'
						: 'bg-[var(--qx-surface)]'}"
					onclick={() => (filterTag = '')}>全部</button
				>
				{#each MOOD_TAGS as tag (tag)}
					<button
						type="button"
						class="min-h-11 rounded-full px-4 {filterTag === tag
							? 'bg-[var(--qx-primary)] text-white'
							: 'bg-[var(--qx-surface)]'}"
						onclick={() => (filterTag = tag)}>{tag}</button
					>
				{/each}
			</div>
			{#if points.length === 0}
				<EmptyState title="还没有趋势" body="先记下一两天，折线就会慢慢出现。" icon="cloud" />
			{:else}
				<TrendChart {points} />
			{/if}
		</Card>
		<Card class="space-y-2">
			<h2 class="text-lg font-semibold">本月摘要</h2>
			<p class="text-base leading-7">{summary.text}</p>
			<p class="text-sm text-[var(--qx-muted)]">{summary.disclaimer}</p>
		</Card>
	{:else}
		<div class="grid gap-3 sm:grid-cols-2">
			<button type="button" class="text-left" onclick={openBreath}>
				<Card class="h-full space-y-2">
					<Icon name="cloud" />
					<h2 class="text-lg font-semibold">4-7-8 呼吸</h2>
					<p class="text-base text-[var(--qx-muted)]">吸气四、屏息七、呼气八。</p>
				</Card>
			</button>
			<button
				type="button"
				class="text-left"
				onclick={() => {
					overlay = 'mixer';
					breathStarted = performance.now();
				}}
			>
				<Card class="h-full space-y-2">
					<Icon name="pulse" />
					<h2 class="text-lg font-semibold">白噪音混合</h2>
					<p class="text-base text-[var(--qx-muted)]">雨声、海浪、风扇，叠在一起。</p>
				</Card>
			</button>
			<button type="button" class="text-left" onclick={() => openStory(stories[0] ?? null)}>
				<Card class="h-full space-y-2">
					<Icon name="book" />
					<h2 class="text-lg font-semibold">睡前小故事</h2>
					<p class="text-base text-[var(--qx-muted)]">两则很短的中文故事。</p>
				</Card>
			</button>
			<button type="button" class="text-left" onclick={() => startTimer(180)}>
				<Card class="h-full space-y-2">
					<Icon name="moon" />
					<h2 class="text-lg font-semibold">全屏计时</h2>
					<p class="text-base text-[var(--qx-muted)]">给自己三分钟不被打断。</p>
				</Card>
			</button>
		</div>
		{#if stories.length}
			<div class="space-y-3">
				{#each stories as item (item.id)}
					<Card>
						<button type="button" class="w-full text-left" onclick={() => openStory(item)}>
							<h3 class="text-lg font-semibold">{item.title}</h3>
							<p class="mt-1 line-clamp-2 text-base text-[var(--qx-muted)]">{item.body}</p>
						</button>
					</Card>
				{/each}
			</div>
		{/if}
	{/if}

	<p class="text-sm leading-6 text-[var(--qx-muted)]">
		{DISCLAIMER} 轻心不是危机干预。需要立刻说话时，请使用 {HOTLINE_NAME} {HOTLINE_NUMBER}。
	</p>
</section>

<Modal bind:open={hotlineOpen} title={HOTLINE_NAME}>
	<p>即将拨打 {HOTLINE_NUMBER}。轻心不提供危机干预或心理治疗，这条热线由专业机构接听。</p>
	{#snippet footer()}
		<Button onclick={confirmHotline}>确认拨打</Button>
		<Button variant="secondary" onclick={() => (hotlineOpen = false)}>取消</Button>
	{/snippet}
</Modal>

<Modal bind:open={storyOpen} title={story?.title ?? '故事'}>
	<p class="text-base leading-8 text-[var(--qx-text)]">{story?.body}</p>
	{#snippet footer()}
		<Button
			onclick={async () => {
				if (story) {
					try {
						await saveMeditationSession({
							kind: 'story',
							durationSec: 60,
							payload: { id: story.id }
						});
					} catch {
						/* ignore */
					}
				}
				storyOpen = false;
				story = null;
			}}>读完了</Button
		>
	{/snippet}
</Modal>

{#if overlay}
	<div class="qx-mood-overlay fixed inset-0 z-50 flex flex-col bg-[#0b1220] text-[#f9fafb]">
		<div class="flex-1 px-6 pt-12">
			{#if overlay === 'breathe'}
				<div class="flex h-full flex-col items-center justify-center gap-8">
					<div
						class="qx-mood-orb flex h-52 w-52 items-center justify-center rounded-full bg-[color-mix(in_srgb,#60a5fa_28%,transparent)]"
						style="transform: scale({breathScale})"
					>
						<span class="text-2xl font-medium">{breathLabel}</span>
					</div>
					<p class="text-base text-slate-300">4 吸 · 7 停 · 8 呼</p>
				</div>
			{:else if overlay === 'timer'}
				<div class="flex h-full flex-col items-center justify-center gap-6">
					<p class="font-[Outfit] text-6xl tracking-tight">{formatClock(timerLeft)}</p>
					<div class="flex flex-wrap justify-center gap-2">
						{#each [60, 180, 300, 600] as seconds (seconds)}
							<Button variant="secondary" onclick={() => startTimer(seconds)}>{seconds / 60} 分钟</Button>
						{/each}
					</div>
				</div>
			{:else}
				<div class="mx-auto max-w-md space-y-5">
					<h2 class="text-2xl font-semibold">白噪音混合</h2>
					{#each SOUND_PRESETS as preset (preset.id)}
						<label class="block space-y-2">
							<span class="text-base">{preset.name}</span>
							<input
								class="h-11 w-full accent-[var(--qx-primary)]"
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={levels[preset.id]}
								oninput={(event) => setLevel(preset.id, Number(event.currentTarget.value))}
							/>
						</label>
					{/each}
					<Button class="w-full" onclick={startMixer}>{mixerOn ? '已在播放' : '开始混合'}</Button>
				</div>
			{/if}
		</div>
		<div class="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
			<Button class="w-full" variant="secondary" onclick={closeOverlay}>关闭</Button>
		</div>
	</div>
{/if}

<style>
	.qx-mood-orb {
		transition: transform 180ms ease;
		box-shadow: 0 0 70px rgba(96, 165, 250, 0.28);
	}
	@media (prefers-reduced-motion: reduce) {
		.qx-mood-orb {
			transition: none;
		}
	}
</style>

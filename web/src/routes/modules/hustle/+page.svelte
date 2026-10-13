<script lang="ts">
	import { onMount } from 'svelte';
	import { getApi } from '#lib/api/mock';
	import type { HustleAiText, ResumeVersion } from '#lib/api/types';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Input from '#lib/components/Input.svelte';
	import Tabs from '#lib/components/Tabs.svelte';
	import Tag from '#lib/components/Tag.svelte';
	import Textarea from '#lib/components/Textarea.svelte';
	import { DISCLAIMER, suggestionReason } from '#lib/hustle/ai';
	import {
		HUSTLE_KINDS,
		INTERVIEW_DIFFICULTIES,
		INTERVIEW_QUESTIONS,
		INTERVIEW_ROLES,
		type HustleKind,
		type InterviewQuestion,
		type SideHustle
	} from '#lib/hustle/catalog';
	import FunnelChart from '#lib/hustle/FunnelChart.svelte';
	import { funnelStages, type Application, type ApplicationStatus } from '#lib/hustle/funnel';
	import { printResume, validateResumeContent, type ResumeContent } from '#lib/hustle/resume';
	import ResumePreview from '#lib/hustle/ResumePreview.svelte';
	import { APPLICATION_STATUSES, moveApplication, statusTone } from '#lib/hustle/status';
	import {
		cacheApplications,
		cacheResumes,
		cacheSideHustles,
		loadCachedApplications,
		loadCachedResumes,
		loadCachedSideHustles,
		saveApplication
	} from '#lib/hustle/store';
	import { todayTodos } from '#lib/hustle/todos';
	import { quoteSheet } from '#lib/hustle/quote';
	import { pushToast } from '#lib/toast';

	let tab = $state(0);
	let jobPane = $state<'resume' | 'board' | 'bank'>('resume');
	let hustlePane = $state<'ideas' | 'quote'>('ideas');
	let needLogin = $state(false);
	let applications = $state<Application[]>([]);
	let resumes = $state<ResumeVersion[]>([]);
	let activeResumeId = $state('');
	let content = $state({
		name: '',
		title: '',
		email: '',
		phone: '',
		summary: '',
		education: [{ school: '', degree: '', years: '' }],
		experience: [{ company: '', role: '', years: '', bullets: '' }],
		skills: [] as string[]
	});
	let skillsText = $state('');
	let optimize = $state<HustleAiText | null>(null);
	let pending = $state(false);
	let company = $state('');
	let position = $state('');
	let sideHustles = $state<SideHustle[]>([]);
	let kindFilter = $state<HustleKind | ''>('');
	let skillQuery = $state('设计, 写作');
	let hoursQuery = $state('6');
	let suggestions = $state<SideHustle[]>([]);
	let suggestNote = $state('');
	let quoteHours = $state('10');
	let quoteDifficulty = $state('3');
	let roleFilter = $state('');
	let difficultyFilter = $state('');
	let questions = $state<InterviewQuestion[]>(INTERVIEW_QUESTIONS);
	let mockReply = $state<HustleAiText | null>(null);
	let dragOver = $state<ApplicationStatus | null>(null);

	const stages = $derived(funnelStages(applications));
	const todos = $derived(todayTodos(applications, new Date().toISOString().slice(0, 10)));
	const quote = $derived(
		quoteSheet({ hours: Number(quoteHours), difficulty: Number(quoteDifficulty) })
	);
	const filteredHustles = $derived(
		kindFilter ? sideHustles.filter((item) => item.kind === kindFilter) : sideHustles
	);

	onMount(() => {
		void boot();
	});

	async function boot() {
		const session = await getApi().getSession();
		if (!session) {
			needLogin = true;
			return;
		}
		needLogin = false;
		try {
			applications = await getApi().listApplications();
		} catch {
			applications = await loadCachedApplications();
		}
		if (applications.length) await cacheApplications(applications);
		try {
			resumes = await getApi().listResumes();
		} catch {
			resumes = await loadCachedResumes();
		}
		if (resumes.length) await cacheResumes(resumes);
		const current = resumes[0];
		if (current) {
			activeResumeId = current.id;
			applyContent(current.content);
		}
		try {
			sideHustles = await getApi().listSideHustles();
		} catch {
			sideHustles = await loadCachedSideHustles();
		}
		if (sideHustles.length) await cacheSideHustles(sideHustles);
		try {
			questions = await getApi().listHustleQuestions();
		} catch {
			questions = INTERVIEW_QUESTIONS;
		}
	}

	async function persistResume() {
		const checked = validateResumeContent({
			...content,
			skills: skillsText
				.split(/[,，]/)
				.map((item) => item.trim())
				.filter(Boolean)
		});
		if (!checked.ok) {
			pushToast({ title: checked.message, tone: 'danger' });
			return;
		}
		applyContent(checked.value);
		pending = true;
		try {
			if (activeResumeId) {
				const saved = await getApi().patchResume(activeResumeId, { content: checked.value });
				resumes = resumes.map((item) => (item.id === saved.id ? saved : item));
			} else {
				const saved = await getApi().createResume({
					title: checked.value.title,
					content: checked.value
				});
				activeResumeId = saved.id;
				resumes = [saved, ...resumes];
			}
			await cacheResumes(resumes);
			pushToast({ title: '简历已保存', tone: 'success' });
		} catch {
			pushToast({ title: '没能保存，请再试一次', tone: 'danger' });
		}
		pending = false;
	}

	async function newVersion() {
		const checked = validateResumeContent({
			...content,
			skills: skillsText
				.split(/[,，]/)
				.map((item) => item.trim())
				.filter(Boolean)
		});
		if (!checked.ok) {
			pushToast({ title: checked.message, tone: 'danger' });
			return;
		}
		pending = true;
		try {
			const saved = await getApi().createResume({
				title: `${checked.value.title || '简历'} v${resumes.length + 1}`,
				content: checked.value
			});
			activeResumeId = saved.id;
			resumes = [saved, ...resumes];
			await cacheResumes(resumes);
			pushToast({ title: `已新建第 ${saved.version} 版`, tone: 'success' });
		} catch {
			pushToast({ title: '没能新建版本', tone: 'danger' });
		}
		pending = false;
	}

	function applyContent(next: ResumeContent) {
		content = {
			name: next.name ?? '',
			title: next.title ?? '',
			email: next.email ?? '',
			phone: next.phone ?? '',
			summary: next.summary ?? '',
			education: next.education?.length ? next.education : [{ school: '', degree: '', years: '' }],
			experience: next.experience?.length
				? next.experience
				: [{ company: '', role: '', years: '', bullets: '' }],
			skills: next.skills ?? []
		};
		skillsText = (next.skills ?? []).join('，');
	}

	function loadVersion(id: string) {
		const found = resumes.find((item) => item.id === id);
		if (!found) return;
		activeResumeId = found.id;
		applyContent(found.content);
	}

	async function runOptimize() {
		if (!activeResumeId) {
			await persistResume();
		}
		if (!activeResumeId) return;
		pending = true;
		try {
			optimize = await getApi().optimizeResume(activeResumeId);
		} catch {
			pushToast({ title: '示意改写暂时不可用', tone: 'danger' });
		}
		pending = false;
	}

	async function addApplication() {
		if (!company.trim() || !position.trim()) {
			pushToast({ title: '请填写公司和职位', tone: 'danger' });
			return;
		}
		const previous = applications;
		try {
			const saved = await saveApplication(
				{ company: company.trim(), position: position.trim() },
				(row) => {
					applications = [row, ...applications];
				},
				() => {
					applications = previous;
				}
			);
			applications = [saved, ...previous.filter((item) => item.id !== saved.id)];
			await cacheApplications(applications);
			company = '';
			position = '';
			pushToast({ title: '已加入投递列', tone: 'success' });
		} catch {
			pushToast({ title: '没能记下这条投递', tone: 'danger' });
		}
	}

	async function moveCard(id: string, status: ApplicationStatus) {
		applications = moveApplication(applications, id, status);
		await cacheApplications(applications);
		try {
			const saved = await getApi().patchApplication(id, { status });
			applications = applications.map((item) => (item.id === id ? saved : item));
		} catch {
			pushToast({ title: '状态会在联网后同步', tone: 'danger' });
		}
	}

	async function saveNotes(app: Application, notes: string) {
		try {
			const saved = await getApi().patchApplication(app.id, { notes });
			applications = applications.map((item) => (item.id === app.id ? saved : item));
		} catch {
			pushToast({ title: '复盘还没写上', tone: 'danger' });
		}
	}

	function onDragStart(event: DragEvent, id: string) {
		event.dataTransfer?.setData('text/plain', id);
		event.dataTransfer?.setDragImage((event.target as HTMLElement) ?? document.body, 20, 20);
	}

	function onDrop(event: DragEvent, status: ApplicationStatus) {
		event.preventDefault();
		dragOver = null;
		const id = event.dataTransfer?.getData('text/plain');
		if (id) void moveCard(id, status);
	}

	async function refreshQuestions() {
		questions = await getApi().listHustleQuestions({
			role: roleFilter || undefined,
			difficulty: difficultyFilter || undefined
		});
	}

	async function askMock(question: InterviewQuestion) {
		pending = true;
		try {
			mockReply = await getApi().mockInterview({ questionId: question.id });
		} catch {
			pushToast({ title: '示意追问暂时不可用', tone: 'danger' });
		}
		pending = false;
	}

	async function runSuggest() {
		const skills = skillQuery
			.split(/[,，]/)
			.map((item) => item.trim())
			.filter(Boolean);
		pending = true;
		try {
			const result = await getApi().suggestSideHustles({
				skills,
				hoursPerWeek: Number(hoursQuery) || 1
			});
			suggestions = result.items;
			suggestNote = result.disclaimer;
		} catch {
			pushToast({ title: '示意灵感暂时不可用', tone: 'danger' });
		}
		pending = false;
	}

	async function saveIdea(item: SideHustle) {
		try {
			const saved = await getApi().createSideHustle({
				title: item.title,
				platform: item.platform,
				estimatedIncome: item.estimatedIncome,
				skillsRequired: item.skillsRequired,
				kind: item.kind,
				hoursPerWeek: item.hoursPerWeek ?? undefined
			});
			sideHustles = [saved, ...sideHustles.filter((row) => row.id !== saved.id)];
			await cacheSideHustles(sideHustles);
			pushToast({ title: '已放入灵感夹', tone: 'success' });
		} catch {
			pushToast({ title: '没能保存这条灵感', tone: 'danger' });
		}
	}
</script>

<svelte:head>
	<title>轻心 · 求职副业</title>
</svelte:head>

<section class="mx-auto max-w-5xl space-y-5">
	<a href="/modules" class="inline-flex min-h-11 items-center text-base text-[var(--qx-muted)]"
		>← 返回模块中心</a
	>
	<div class="flex items-start gap-4">
		<div
			class="flex h-14 w-14 items-center justify-center rounded-2xl text-white"
			style="background:#FBBF24"
		>
			<Icon name="briefcase" class="h-7 w-7" />
		</div>
		<div>
			<Tag tone="primary">工具辅助 · 信息展示</Tag>
			<h1 class="mt-2 text-3xl font-semibold">求职副业</h1>
			<p class="mt-2 text-base text-[var(--qx-muted)]">机会清单与进度板。不构成职场咨询。</p>
		</div>
	</div>

	{#if needLogin}
		<Card>
			<EmptyState
				title="先登录再看进度"
				body="投递、简历和灵感会记在你的账号里，离线时也会先放本地。"
				icon="spark"
			>
				{#snippet action()}
					<Button href="/login">去登录</Button>
				{/snippet}
			</EmptyState>
		</Card>
	{:else}
		<Tabs bind:value={tab} tabs={['求职', '副业', '今日']} />

		{#if tab === 0}
			<div class="flex flex-wrap gap-2">
				{#each [['resume', '简历'], ['board', '看板'], ['bank', '题库']] as item (item[0])}
					<button
						type="button"
						class="min-h-11 rounded-2xl px-4 text-base {jobPane === item[0]
							? 'bg-[var(--qx-card)] shadow-sm'
							: 'text-[var(--qx-muted)]'}"
						onclick={() => (jobPane = item[0] as typeof jobPane)}
					>
						{item[1]}
					</button>
				{/each}
			</div>

			{#if jobPane === 'resume'}
				<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
					<Card>
						<div class="mb-4 flex flex-wrap gap-2">
							{#each resumes as item (item.id)}
								<button type="button" class="min-h-11" onclick={() => loadVersion(item.id)}>
									<Tag tone={item.id === activeResumeId ? 'primary' : 'default'}
										>第 {item.version} 版</Tag
									>
								</button>
							{/each}
						</div>
						<div class="space-y-3">
							<Input label="姓名" bind:value={content.name} placeholder="林轻心" />
							<Input label="求职方向" bind:value={content.title} placeholder="前端工程师" />
							<Input label="邮箱" bind:value={content.email} placeholder="lin@qingxin.app" />
							<Textarea label="简介" bind:value={content.summary} />
							<Input
								label="技能（逗号分隔）"
								bind:value={skillsText}
								placeholder="TypeScript，Svelte"
							/>
							<Input
								label="经历 · 公司"
								bind:value={content.experience[0].company}
								placeholder="河岸工作室"
							/>
							<Input
								label="经历 · 职位"
								bind:value={content.experience[0].role}
								placeholder="前端"
							/>
							<Textarea label="经历说明" bind:value={content.experience[0].bullets} />
						</div>
						<div class="mt-5 flex flex-col gap-3 sm:flex-row">
							<Button onclick={persistResume} disabled={pending} class="whitespace-nowrap"
								>保存这一版</Button
							>
							<Button
								variant="secondary"
								onclick={newVersion}
								disabled={pending}
								class="whitespace-nowrap">新建版本</Button
							>
							<Button variant="ghost" onclick={() => printResume(content)} class="whitespace-nowrap"
								>导出 PDF（打印）</Button
							>
						</div>
						<div class="mt-4">
							<Button variant="secondary" onclick={runOptimize} disabled={pending}>示意优化</Button>
						</div>
						{#if optimize}
							<p class="mt-3 text-base">{optimize.text}</p>
							<p class="mt-2 text-sm text-[var(--qx-muted)]">{optimize.disclaimer}</p>
						{/if}
					</Card>
					<div>
						<p class="mb-2 text-sm text-[var(--qx-muted)]">A4 预览始终浅色，方便对照纸质投递。</p>
						<div class="resume-a4-shell rounded-3xl bg-[var(--qx-surface)] p-3">
							<div class="resume-a4-fit">
								<ResumePreview {content} />
							</div>
						</div>
					</div>
				</div>
			{:else if jobPane === 'board'}
				<Card>
					<div class="grid gap-3 sm:grid-cols-2">
						<Input label="公司" bind:value={company} placeholder="轻心实验室" />
						<Input label="职位" bind:value={position} placeholder="前端工程师" />
					</div>
					<div class="mt-4">
						<Button onclick={addApplication}>加入投递</Button>
					</div>
				</Card>
				<Card>
					<h2 class="text-lg font-semibold">投递漏斗</h2>
					<FunnelChart {stages} />
				</Card>
				<div class="grid gap-3 lg:grid-cols-3">
					{#each APPLICATION_STATUSES as status (status)}
						<div
							class="rounded-3xl bg-[var(--qx-surface)] p-3"
							ondragover={(event) => {
								event.preventDefault();
								dragOver = status;
							}}
							ondragleave={() => {
								if (dragOver === status) dragOver = null;
							}}
							ondrop={(event) => onDrop(event, status)}
							role="list"
							aria-label={status}
						>
							<div class="mb-3 flex items-center justify-between">
								<Tag tone={statusTone(status)}>{status}</Tag>
								<span class="text-sm text-[var(--qx-muted)]"
									>{applications.filter((item) => item.status === status).length}</span
								>
							</div>
							<div
								class="space-y-3 {dragOver === status
									? 'rounded-3xl ring-2 ring-[var(--qx-primary)]'
									: ''}"
							>
								{#each applications.filter((item) => item.status === status) as app (app.id)}
									<Card class="hustle-kanban-card">
										<div
											draggable="true"
											ondragstart={(event) => onDragStart(event, app.id)}
											role="listitem"
											class="cursor-grab"
										>
											<div class="flex items-start justify-between gap-2">
												<div>
													<h3 class="text-base font-semibold">{app.company}</h3>
													<p class="text-sm text-[var(--qx-muted)]">{app.position}</p>
												</div>
												<Tag tone={statusTone(app.status)}>{app.status}</Tag>
											</div>
											<label class="mt-3 block text-sm text-[var(--qx-muted)]">
												移动到
												<select
													class="mt-1 min-h-11 w-full rounded-2xl border border-[var(--qx-line)] bg-[var(--qx-bg)] px-3"
													value={app.status}
													onchange={(event) =>
														void moveCard(
															app.id,
															(event.currentTarget as HTMLSelectElement).value as ApplicationStatus
														)}
												>
													{#each APPLICATION_STATUSES as option (option)}
														<option value={option}>{option}</option>
													{/each}
												</select>
											</label>
											<Textarea
												label="面试复盘"
												value={app.notes ?? ''}
												onblur={(event) =>
													void saveNotes(app, (event.currentTarget as HTMLTextAreaElement).value)}
											/>
											{#if app.interviewDate}
												<p class="mt-2 text-sm text-[var(--qx-muted)]">面试 {app.interviewDate}</p>
											{/if}
										</div>
									</Card>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						class="min-h-11 rounded-2xl px-4"
						onclick={() => {
							roleFilter = '';
							void refreshQuestions();
						}}
					>
						<Tag tone={roleFilter === '' ? 'primary' : 'default'}>全部方向</Tag>
					</button>
					{#each INTERVIEW_ROLES as role (role)}
						<button
							type="button"
							class="min-h-11 rounded-2xl px-4"
							onclick={() => {
								roleFilter = role;
								void refreshQuestions();
							}}
						>
							<Tag tone={roleFilter === role ? 'primary' : 'default'}>{role}</Tag>
						</button>
					{/each}
				</div>
				<div class="flex flex-wrap gap-2">
					{#each INTERVIEW_DIFFICULTIES as level (level)}
						<button
							type="button"
							class="min-h-11 rounded-2xl px-4"
							onclick={() => {
								difficultyFilter = difficultyFilter === level ? '' : level;
								void refreshQuestions();
							}}
						>
							<Tag tone={difficultyFilter === level ? 'warm' : 'default'}>{level}</Tag>
						</button>
					{/each}
				</div>
				<div class="space-y-3">
					{#each questions as question (question.id)}
						<Card>
							<div class="flex flex-wrap items-center gap-2">
								<Tag>{question.role}</Tag>
								<Tag tone="warm">{question.difficulty}</Tag>
							</div>
							<p class="mt-3 text-base">{question.prompt}</p>
							<div class="mt-4">
								<Button variant="secondary" onclick={() => askMock(question)} disabled={pending}
									>示意追问</Button
								>
							</div>
						</Card>
					{/each}
				</div>
				{#if mockReply}
					<Card>
						<Tag>示意面试官</Tag>
						<p class="mt-3 text-base">{mockReply.text}</p>
						<p class="mt-2 text-sm text-[var(--qx-muted)]">{mockReply.disclaimer}</p>
					</Card>
				{/if}
			{/if}
		{:else if tab === 1}
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					class="min-h-11 rounded-2xl px-4"
					onclick={() => (hustlePane = 'ideas')}
				>
					<Tag tone={hustlePane === 'ideas' ? 'primary' : 'default'}>灵感</Tag>
				</button>
				<button
					type="button"
					class="min-h-11 rounded-2xl px-4"
					onclick={() => (hustlePane = 'quote')}
				>
					<Tag tone={hustlePane === 'quote' ? 'primary' : 'default'}>报价</Tag>
				</button>
			</div>
			{#if hustlePane === 'ideas'}
				<Card>
					<div class="grid gap-3 sm:grid-cols-2">
						<Input label="我会的（逗号分隔）" bind:value={skillQuery} />
						<Input label="每周可投入小时" bind:value={hoursQuery} type="number" />
					</div>
					<div class="mt-4">
						<Button onclick={runSuggest} disabled={pending}>示意灵感</Button>
					</div>
					{#if suggestions.length}
						<p class="mt-3 text-sm text-[var(--qx-muted)]">{suggestNote || DISCLAIMER}</p>
					{/if}
				</Card>
				<div class="flex flex-wrap gap-2">
					<button type="button" class="min-h-11" onclick={() => (kindFilter = '')}
						><Tag tone={kindFilter === '' ? 'primary' : 'default'}>全部</Tag></button
					>
					{#each HUSTLE_KINDS as kind (kind)}
						<button type="button" class="min-h-11" onclick={() => (kindFilter = kind)}>
							<Tag tone={kindFilter === kind ? 'primary' : 'default'}>{kind}</Tag>
						</button>
					{/each}
				</div>
				<div class="grid gap-3 sm:grid-cols-2">
					{#each [...suggestions, ...filteredHustles] as item (item.id)}
						<Card>
							<div class="flex items-start justify-between gap-2">
								<h2 class="text-lg font-semibold">{item.title}</h2>
								<Tag>{item.kind}</Tag>
							</div>
							<p class="mt-1 text-base text-[var(--qx-muted)]">{item.platform}</p>
							<p class="mt-3 text-base">示意收入约 {item.estimatedIncome} 元 / 月</p>
							<p class="mt-1 text-sm text-[var(--qx-muted)]">{item.skillsRequired.join(' · ')}</p>
							{#if suggestions.some((row) => row.id === item.id)}
								<p class="mt-2 text-sm text-[var(--qx-muted)]">
									{suggestionReason(item, Number(hoursQuery) || 1)}
								</p>
								<div class="mt-4">
									<Button variant="secondary" onclick={() => saveIdea(item)}>放入灵感夹</Button>
								</div>
							{/if}
						</Card>
					{/each}
				</div>
			{:else}
				<Card>
					<h2 class="text-lg font-semibold">报价计算器</h2>
					<p class="mt-1 text-sm text-[var(--qx-muted)]">
						系数只是示意：0.7 + 难度 × 0.3，默认 200 元 / 小时。
					</p>
					<div class="mt-4 grid gap-3 sm:grid-cols-2">
						<Input label="工时（小时）" bind:value={quoteHours} type="number" />
						<Input label="难度 1–5" bind:value={quoteDifficulty} type="number" min="1" max="5" />
					</div>
					{#if quote.ok}
						<div class="mt-5 space-y-2 rounded-2xl bg-[var(--qx-surface)] p-4">
							<p>工时 {quote.value.hours} 小时</p>
							<p>难度系数 {quote.value.multiplier}</p>
							<p>单价 {quote.value.hourlyRate} 元</p>
							<p class="text-xl font-semibold">合计 {quote.value.total} 元</p>
						</div>
					{:else}
						<p class="mt-4 text-[var(--qx-muted)]">{quote.message}</p>
					{/if}
				</Card>
			{/if}
		{:else}
			<Card>
				<h2 class="text-lg font-semibold">求职概览</h2>
				<div class="mt-4 flex flex-wrap gap-2">
					{#each stages as stage (stage.status)}
						<Tag tone={statusTone(stage.status)}>{stage.status} {stage.count}</Tag>
					{/each}
				</div>
				<FunnelChart {stages} />
			</Card>
			<Card>
				<h2 class="text-lg font-semibold">今日待办</h2>
				{#if todos.length === 0}
					<EmptyState
						title="今天还没有面试或跟进"
						body="把投递放进看板后，这里会列出今日面试和待跟进。"
						icon="spark"
					/>
				{:else}
					<ul class="mt-3 space-y-3">
						{#each todos as item (item.id)}
							<li class="rounded-2xl bg-[var(--qx-surface)] p-4">
								<p class="font-medium">{item.title}</p>
								<p class="text-sm text-[var(--qx-muted)]">{item.detail}</p>
							</li>
						{/each}
					</ul>
				{/if}
			</Card>
		{/if}
	{/if}
	<p class="text-sm text-[var(--qx-muted)]">{DISCLAIMER}</p>
</section>

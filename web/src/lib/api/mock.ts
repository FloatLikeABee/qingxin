import { MODULES } from '../modules';
import {
	CATEGORIES,
	COMMUNITY_ORIGIN,
	ELDER_TAGS,
	SEED_REVIEWS,
	SEED_SERVICES,
	type CorrectionKind,
	type ElderTag,
	type LocalCategory,
	type LocalCorrection,
	type LocalReview,
	type LocalService
} from '../local/catalog';
import { searchServices, sortServices, type LocalSort } from '../local/geo';
import { validateCorrection, validatePublish, validateReview } from '../local/validate';
import {
	DEFAULT_RESUME,
	INTERVIEW_DIFFICULTIES,
	INTERVIEW_QUESTIONS,
	INTERVIEW_ROLES,
	SEED_SIDE_HUSTLES,
	seedApplications,
	type InterviewQuestion,
	type SideHustle
} from '../hustle/catalog';
import { filterQuestions, filterSideHustles } from '../hustle/filter';
import { funnelStages, isApplicationStatus, type Application } from '../hustle/funnel';
import {
	DISCLAIMER as HUSTLE_DISCLAIMER,
	mockInterviewer,
	mockOptimize,
	mockSuggestions
} from '../hustle/ai';
import { validateResumeContent, type ResumeContent } from '../hustle/resume';
import {
	DISCLAIMER as CREATE_DISCLAIMER,
	mockGenerate,
	mockOutline,
	mockPolish,
	mockTitles
} from '../create/ai';
import { chunkText, DISCLAIMER as TOOLS_DISCLAIMER, mockRun } from '../tools/ai';
import { isToolId, mergeCatalog, POLISH_TONES, type ToolId } from '../tools/catalog';
import {
	filterTemplates,
	INSPIRATION,
	isCreatePlatform,
	isCreateTone,
	isSnippetKind,
	TEMPLATES,
	type CreateLength,
	type CreatePlatform,
	type CreateTone,
	type SnippetKind
} from '../create/catalog';
import { BEDTIME_STORIES, SOUND_PRESETS } from '../mood/catalog';
import { DISCLAIMER, mockInsight } from '../mood/insight';
import { aggregateTrends, type MoodLog } from '../mood/trends';
import { validateCheckIn } from '../mood/validate';
import {
	ApiError,
	type CreateAiText,
	type CreateOutlineResult,
	type CreateSnippet,
	type CreateTitles,
	type Creation,
	type ExportPayload,
	type HustleAiText,
	type MeditationKind,
	type MeditationSession,
	type MoodInsight,
	type AiTask,
	type AiTemplate,
	type QingxinApi,
	type ResumeVersion,
	type Session,
	type SideHustleSuggest,
	type ToolCatalog,
	type ToolRunInput,
	type ToolStreamEvent
} from './types';
import { QingxinModuleMemory } from './mock-modules';
import type { ElderReminderInput } from '../elder/payload';
import type {
	FinanceBudgetInput,
	FinanceChallengeInput,
	FinanceSubInput,
	FinanceTxInput
} from '../finance/payload';
import type { CycleLog, PlanLog, ReminderLog, ReportLog } from '../wellness/types';

export { ApiError } from './types';
export type { QingxinApi, Session } from './types';

const DEMO_EMAIL = 'demo@qingxin.app';
const DEMO_PASSWORD = 'qingxin';
const SESSION_KEY = 'qingxin.session';
const LOGS_KEY = 'qingxin.moodLogs';
const SESSIONS_KEY = 'qingxin.meditationSessions';
const APPS_KEY = 'qingxin.hustleApplications';
const RESUMES_KEY = 'qingxin.hustleResumes';
const HUSTLES_KEY = 'qingxin.sideHustles';
const CREATIONS_KEY = 'qingxin.creations';
const SNIPPETS_KEY = 'qingxin.createSnippets';
const AI_TASKS_KEY = 'qingxin.aiTasks';
const AI_TEMPLATES_KEY = 'qingxin.aiTemplates';

const KINDS: MeditationKind[] = ['breathe', 'noise', 'story', 'timer'];

function readStoredSession(): Session | null {
	try {
		const raw = globalThis.localStorage?.getItem(SESSION_KEY);
		return raw ? (JSON.parse(raw) as Session) : null;
	} catch {
		return null;
	}
}

function writeStoredSession(session: Session | null): void {
	try {
		if (!session) {
			globalThis.localStorage?.removeItem(SESSION_KEY);
			return;
		}
		globalThis.localStorage?.setItem(SESSION_KEY, JSON.stringify(session));
	} catch {
		// Private mode: keep the in-memory session only.
	}
}

function readUserMap<T>(key: string): Record<string, T[]> {
	try {
		const raw = globalThis.localStorage?.getItem(key);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as Record<string, T[]>;
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

function writeUserMap<T>(key: string, value: Record<string, T[]>): void {
	try {
		globalThis.localStorage?.setItem(key, JSON.stringify(value));
	} catch {
		// Private mode: keep the in-memory copy only.
	}
}

function persistUserList<T>(mem: Map<string, T[]>, key: string, userId: string, items: T[]): T[] {
	mem.set(userId, items);
	const all = readUserMap<T>(key);
	all[userId] = items;
	writeUserMap(key, all);
	return items;
}

function hydrateUserList<T>(
	mem: Map<string, T[]>,
	key: string,
	userId: string,
	fallback: T[]
): T[] {
	const cached = mem.get(userId);
	if (cached) return cached;
	const all = readUserMap<T>(key);
	if (Object.prototype.hasOwnProperty.call(all, userId)) {
		const stored = all[userId] ?? [];
		mem.set(userId, stored);
		return stored;
	}
	return persistUserList(mem, key, userId, fallback);
}

function forgetUserLists(
	logs: Map<string, MoodLog[]>,
	sessions: Map<string, MeditationSession[]>,
	apps: Map<string, Application[]>,
	resumes: Map<string, ResumeVersion[]>,
	hustles: Map<string, SideHustle[]>,
	creations: Map<string, Creation[]>,
	snippets: Map<string, CreateSnippet[]>,
	aiTasks: Map<string, AiTask[]>,
	aiTemplates: Map<string, AiTemplate[]>,
	userId: string
) {
	logs.delete(userId);
	sessions.delete(userId);
	apps.delete(userId);
	resumes.delete(userId);
	hustles.delete(userId);
	creations.delete(userId);
	snippets.delete(userId);
	aiTasks.delete(userId);
	aiTemplates.delete(userId);
	for (const key of [
		LOGS_KEY,
		SESSIONS_KEY,
		APPS_KEY,
		RESUMES_KEY,
		HUSTLES_KEY,
		CREATIONS_KEY,
		SNIPPETS_KEY,
		AI_TASKS_KEY,
		AI_TEMPLATES_KEY
	]) {
		const stored = readUserMap(key);
		delete stored[userId];
		writeUserMap(key, stored);
	}
}

function seedResumes(userId: string): ResumeVersion[] {
	const now = new Date().toISOString();
	return [
		{
			id: `seed-resume-${userId}`,
			version: 1,
			title: '投前端',
			content: DEFAULT_RESUME,
			pdfUrl: null,
			createdAt: now,
			updatedAt: now
		}
	];
}

function requireSession(session: Session | null): Session {
	if (!session) throw new ApiError('unauthenticated', '请先登录');
	return session;
}

function seedCreations(userId: string): Creation[] {
	const now = new Date().toISOString();
	return [
		{
			id: `seed-create-${userId}`,
			platform: '小红书',
			title: '阳台种菜',
			promptParams: { topic: '阳台种菜', tone: '更专业', length: '短' },
			generatedContent: '【小红书·更专业·短】阳台种菜：把日常写成可收藏的日常。此为示意文案。',
			finalContent: '【小红书·更专业·短】阳台种菜：把日常写成可收藏的日常。此为示意文案。',
			versions: [
				{
					at: now,
					kind: 'generate',
					content: '【小红书·更专业·短】阳台种菜：把日常写成可收藏的日常。此为示意文案。'
				}
			],
			createdAt: now,
			updatedAt: now
		}
	];
}

function seedSnippets(userId: string): CreateSnippet[] {
	const now = new Date().toISOString();
	return [
		{
			id: `seed-snip-${userId}`,
			content: '把结论写在第一句。',
			kind: '金句',
			tags: ['开头'],
			usageCount: 2,
			createdAt: now,
			updatedAt: now
		}
	];
}

function seedLogs(userId: string): MoodLog[] {
	const days = [
		{ emoji: '😔', score: 2, tags: ['睡眠'], note: '夜里醒了两次' },
		{ emoji: '🙂', score: 4, tags: ['运动'], note: '散步十分钟' },
		{ emoji: '😐', score: 3, tags: ['工作'], note: '会议很多' },
		{ emoji: '😄', score: 5, tags: ['家庭'], note: '晚饭很暖' },
		{ emoji: '😰', score: 2, tags: ['压力'], note: '有点赶' },
		{ emoji: '🥰', score: 5, tags: ['社交'], note: '朋友来信' },
		{ emoji: '🙂', score: 4, tags: ['健康'], note: '喝了热水' }
	];
	const now = Date.now();
	return days.map((item, index) => ({
		id: `seed-${userId}-${index}`,
		emoji: item.emoji,
		score: item.score,
		tags: item.tags,
		note: item.note,
		createdAt: new Date(now - (6 - index) * 86400000).toISOString()
	}));
}

export class MockQingxinApi implements QingxinApi {
	#session: Session | null = null;
	#logs = new Map<string, MoodLog[]>();
	#sessions = new Map<string, MeditationSession[]>();
	#apps = new Map<string, Application[]>();
	#resumes = new Map<string, ResumeVersion[]>();
	#hustles = new Map<string, SideHustle[]>();
	#creations = new Map<string, Creation[]>();
	#snippets = new Map<string, CreateSnippet[]>();
	#aiTasks = new Map<string, AiTask[]>();
	#aiTemplates = new Map<string, AiTemplate[]>();
	#services: LocalService[] = SEED_SERVICES.map((item) => ({ ...item, tags: [...item.tags] }));
	#reviews: LocalReview[] = SEED_REVIEWS.map((item) => ({ ...item }));
	#corrections: LocalCorrection[] = [];
	#mod = new QingxinModuleMemory(() => this.#ensureSession());

	#ensureSession(): Session {
		this.#session ??= readStoredSession();
		return requireSession(this.#session);
	}

	#hydrateHustle(userId: string) {
		hydrateUserList(this.#apps, APPS_KEY, userId, seedApplications());
		hydrateUserList(this.#resumes, RESUMES_KEY, userId, seedResumes(userId));
		hydrateUserList(this.#hustles, HUSTLES_KEY, userId, SEED_SIDE_HUSTLES);
	}

	#hydrateCreate(userId: string) {
		hydrateUserList(this.#creations, CREATIONS_KEY, userId, seedCreations(userId));
		hydrateUserList(this.#snippets, SNIPPETS_KEY, userId, seedSnippets(userId));
	}

	#hydrateTools(userId: string) {
		hydrateUserList(this.#aiTasks, AI_TASKS_KEY, userId, []);
		hydrateUserList(this.#aiTemplates, AI_TEMPLATES_KEY, userId, []);
	}

	async getSession(): Promise<Session | null> {
		this.#session ??= readStoredSession();
		if (this.#session) {
			hydrateUserList(this.#logs, LOGS_KEY, this.#session.userId, seedLogs(this.#session.userId));
			hydrateUserList(this.#sessions, SESSIONS_KEY, this.#session.userId, []);
			this.#hydrateHustle(this.#session.userId);
			this.#hydrateCreate(this.#session.userId);
			this.#hydrateTools(this.#session.userId);
		}
		return this.#session;
	}

	async login(email: string, password: string): Promise<Session> {
		if (!email.trim() || !password.trim()) {
			throw new ApiError('invalid_credentials', '请输入邮箱和密码');
		}
		if (email !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
			throw new ApiError('invalid_credentials', '账号或密码不正确');
		}
		this.#session = {
			userId: 'user-demo',
			displayName: '轻心同学',
			email: DEMO_EMAIL,
			token: 'mock-token-demo'
		};
		writeStoredSession(this.#session);
		hydrateUserList(this.#logs, LOGS_KEY, this.#session.userId, seedLogs(this.#session.userId));
		hydrateUserList(this.#sessions, SESSIONS_KEY, this.#session.userId, []);
		this.#hydrateHustle(this.#session.userId);
		this.#hydrateCreate(this.#session.userId);
		this.#hydrateTools(this.#session.userId);
		return this.#session;
	}

	async register(name: string, email: string, password: string): Promise<Session> {
		if (!name.trim() || !email.trim() || password.length < 6) {
			throw new ApiError('invalid_credentials', '请填写姓名、邮箱，密码至少 6 位');
		}
		this.#session = {
			userId: `user-${email}`,
			displayName: name.trim(),
			email: email.trim(),
			token: 'mock-token-new'
		};
		writeStoredSession(this.#session);
		persistUserList(this.#logs, LOGS_KEY, this.#session.userId, []);
		persistUserList(this.#sessions, SESSIONS_KEY, this.#session.userId, []);
		persistUserList(this.#apps, APPS_KEY, this.#session.userId, []);
		persistUserList(this.#resumes, RESUMES_KEY, this.#session.userId, []);
		persistUserList(this.#hustles, HUSTLES_KEY, this.#session.userId, []);
		persistUserList(this.#creations, CREATIONS_KEY, this.#session.userId, []);
		persistUserList(this.#snippets, SNIPPETS_KEY, this.#session.userId, []);
		persistUserList(this.#aiTasks, AI_TASKS_KEY, this.#session.userId, []);
		persistUserList(this.#aiTemplates, AI_TEMPLATES_KEY, this.#session.userId, []);
		return this.#session;
	}

	async logout(): Promise<void> {
		this.#session = null;
		writeStoredSession(null);
	}

	async listModules() {
		return MODULES;
	}

	async exportUserData(): Promise<ExportPayload> {
		const session = requireSession(this.#session);
		return {
			exportedAt: new Date().toISOString(),
			data: {
				email: session.email,
				displayName: session.displayName,
				modules: MODULES.map((item) => item.name),
				moodLogs: [...(this.#logs.get(session.userId) ?? [])],
				meditationSessions: [...(this.#sessions.get(session.userId) ?? [])],
				applications: [...(this.#apps.get(session.userId) ?? [])],
				resumes: [...(this.#resumes.get(session.userId) ?? [])],
				sideHustles: [...(this.#hustles.get(session.userId) ?? [])],
				localReviews: this.#reviews.filter((item) => item.userId === session.userId),
				localServices: this.#services.filter((item) => item.createdBy === session.userId),
				localCorrections: this.#corrections.filter((item) => item.userId === session.userId),
				creations: [...(this.#creations.get(session.userId) ?? [])],
				snippets: [...(this.#snippets.get(session.userId) ?? [])],
				aiTasks: [...(this.#aiTasks.get(session.userId) ?? [])],
				aiTemplates: [...(this.#aiTemplates.get(session.userId) ?? [])]
			}
		};
	}

	async deleteAccount(): Promise<void> {
		if (this.#session) {
			const userId = this.#session.userId;
			forgetUserLists(
				this.#logs,
				this.#sessions,
				this.#apps,
				this.#resumes,
				this.#hustles,
				this.#creations,
				this.#snippets,
				this.#aiTasks,
				this.#aiTemplates,
				userId
			);
			this.#reviews = this.#reviews.filter((item) => item.userId !== userId);
			this.#corrections = this.#corrections.filter((item) => item.userId !== userId);
			this.#services = this.#services.filter((item) => item.createdBy !== userId);
		}
		this.#session = null;
		writeStoredSession(null);
	}

	async createMoodLog(input: {
		id?: string;
		emoji: string;
		tags: string[];
		note?: string;
	}): Promise<MoodLog> {
		const session = requireSession(this.#session);
		const checked = validateCheckIn(input);
		if (!checked.ok) throw new ApiError(checked.code, checked.message);
		const list = hydrateUserList(this.#logs, LOGS_KEY, session.userId, []);
		const id = input.id ?? crypto.randomUUID();
		const existing = list.find((item) => item.id === id);
		if (existing) return existing;
		const log: MoodLog = {
			id,
			emoji: checked.value.emoji,
			score: checked.value.score,
			tags: checked.value.tags,
			note: checked.value.note,
			createdAt: new Date().toISOString()
		};
		persistUserList(this.#logs, LOGS_KEY, session.userId, [log, ...list]);
		return log;
	}

	async listMoodLogs(filter?: { tag?: string }): Promise<MoodLog[]> {
		const session = requireSession(this.#session);
		const list = this.#logs.get(session.userId) ?? [];
		if (!filter?.tag) return [...list];
		return list.filter((item) => item.tags.includes(filter.tag as string));
	}

	async getMoodTrends(period: 'week' | 'month', tag?: string) {
		const logs = await this.listMoodLogs();
		return { period, points: aggregateTrends(logs, period, tag) };
	}

	async createMoodInsight(input: {
		moodLogId?: string;
		emoji?: string;
		tags?: string[];
		note?: string;
	}): Promise<MoodInsight> {
		const session = requireSession(this.#session);
		let emoji = input.emoji ?? '😐';
		let tags = input.tags ?? [];
		if (input.moodLogId) {
			const found = (this.#logs.get(session.userId) ?? []).find(
				(item) => item.id === input.moodLogId
			);
			if (!found) throw new ApiError('not_found', '找不到这条记录');
			emoji = found.emoji;
			tags = found.tags;
		}
		return {
			text: mockInsight(emoji, tags),
			disclaimer: DISCLAIMER,
			source: 'mock'
		};
	}

	async getMonthlyMoodSummary(month: string): Promise<MoodInsight> {
		const logs = await this.listMoodLogs();
		const inMonth = logs.filter((item) => item.createdAt.startsWith(month));
		const text = inMonth.length
			? `这个月记下了${inMonth.length}笔。${mockInsight(
					inMonth[0]?.emoji ?? '😐',
					inMonth.flatMap((item) => item.tags)
				)}`
			: '这个月还没有足够的记录。先写下今天的一笔就好。';
		return { text, disclaimer: DISCLAIMER, source: 'mock', month };
	}

	async getMeditationCatalog() {
		requireSession(this.#session);
		return {
			sounds: SOUND_PRESETS.map((item) => ({ id: item.id, name: item.name })),
			stories: BEDTIME_STORIES.map((item) => ({ id: item.id, title: item.title, body: item.body }))
		};
	}

	async createMeditationSession(input: {
		id?: string;
		kind: MeditationKind;
		durationSec: number;
		payload?: Record<string, unknown>;
	}): Promise<MeditationSession> {
		const session = requireSession(this.#session);
		if (!KINDS.includes(input.kind) || input.durationSec < 0) {
			throw new ApiError('invalid_request', '无法保存这次练习');
		}
		const list = hydrateUserList(this.#sessions, SESSIONS_KEY, session.userId, []);
		const id = input.id ?? crypto.randomUUID();
		const existing = list.find((item) => item.id === id);
		if (existing) return existing;
		const row: MeditationSession = {
			id,
			kind: input.kind,
			durationSec: input.durationSec,
			payload: input.payload ?? {},
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString()
		};
		persistUserList(this.#sessions, SESSIONS_KEY, session.userId, [row, ...list]);
		return row;
	}

	async listMeditationSessions(): Promise<MeditationSession[]> {
		const session = requireSession(this.#session);
		return [...(this.#sessions.get(session.userId) ?? [])];
	}

	async createApplication(input: {
		id?: string;
		company: string;
		position: string;
		status?: Application['status'];
		interviewDate?: string;
		notes?: string;
	}): Promise<Application> {
		const session = requireSession(this.#session);
		if (!input.company.trim() || !input.position.trim()) {
			throw new ApiError('invalid_request', '请填写公司和职位');
		}
		const status = input.status ?? '投递';
		if (!isApplicationStatus(status)) {
			throw new ApiError('invalid_request', '状态不在看板里');
		}
		const list = hydrateUserList(this.#apps, APPS_KEY, session.userId, []);
		const id = input.id ?? crypto.randomUUID();
		const existing = list.find((item) => item.id === id);
		if (existing) return existing;
		const now = new Date().toISOString();
		const row: Application = {
			id,
			company: input.company.trim(),
			position: input.position.trim(),
			status,
			interviewDate: input.interviewDate ?? null,
			notes: input.notes ?? '',
			createdAt: now,
			updatedAt: now
		};
		persistUserList(this.#apps, APPS_KEY, session.userId, [row, ...list]);
		return row;
	}

	async listApplications(): Promise<Application[]> {
		const session = requireSession(this.#session);
		this.#hydrateHustle(session.userId);
		return [...(this.#apps.get(session.userId) ?? [])];
	}

	async patchApplication(
		id: string,
		patch: { status?: Application['status']; interviewDate?: string; notes?: string }
	): Promise<Application> {
		const session = requireSession(this.#session);
		const list = hydrateUserList(this.#apps, APPS_KEY, session.userId, []);
		const index = list.findIndex((item) => item.id === id);
		if (index < 0) throw new ApiError('not_found', '找不到这条投递');
		if (patch.status && !isApplicationStatus(patch.status)) {
			throw new ApiError('invalid_request', '状态不在看板里');
		}
		const current = list[index];
		const next: Application = {
			...current,
			status: patch.status ?? current.status,
			interviewDate: patch.interviewDate ?? current.interviewDate,
			notes: patch.notes ?? current.notes,
			updatedAt: new Date().toISOString()
		};
		const copy = [...list];
		copy[index] = next;
		persistUserList(this.#apps, APPS_KEY, session.userId, copy);
		return next;
	}

	async getHustleFunnel() {
		const apps = await this.listApplications();
		return { stages: funnelStages(apps) };
	}

	async createResume(input: {
		id?: string;
		title?: string;
		content: ResumeContent;
	}): Promise<ResumeVersion> {
		const session = requireSession(this.#session);
		const checked = validateResumeContent(input.content);
		if (!checked.ok) throw new ApiError(checked.code, checked.message);
		const list = hydrateUserList(this.#resumes, RESUMES_KEY, session.userId, []);
		const id = input.id ?? crypto.randomUUID();
		const existing = list.find((item) => item.id === id);
		if (existing) return existing;
		const now = new Date().toISOString();
		const row: ResumeVersion = {
			id,
			version: (list[0]?.version ?? 0) + 1,
			title: input.title ?? null,
			content: checked.value,
			pdfUrl: null,
			createdAt: now,
			updatedAt: now
		};
		persistUserList(this.#resumes, RESUMES_KEY, session.userId, [row, ...list]);
		return row;
	}

	async listResumes(): Promise<ResumeVersion[]> {
		const session = requireSession(this.#session);
		this.#hydrateHustle(session.userId);
		return [...(this.#resumes.get(session.userId) ?? [])];
	}

	async patchResume(
		id: string,
		patch: { title?: string; content?: ResumeContent }
	): Promise<ResumeVersion> {
		const session = requireSession(this.#session);
		const list = hydrateUserList(this.#resumes, RESUMES_KEY, session.userId, []);
		const index = list.findIndex((item) => item.id === id);
		if (index < 0) throw new ApiError('not_found', '找不到这份简历');
		const current = list[index];
		let content = current.content;
		if (patch.content) {
			const checked = validateResumeContent(patch.content);
			if (!checked.ok) throw new ApiError(checked.code, checked.message);
			content = checked.value;
		}
		const next: ResumeVersion = {
			...current,
			title: patch.title ?? current.title,
			content,
			updatedAt: new Date().toISOString()
		};
		const copy = [...list];
		copy[index] = next;
		persistUserList(this.#resumes, RESUMES_KEY, session.userId, copy);
		return next;
	}

	async optimizeResume(id: string): Promise<HustleAiText> {
		const session = requireSession(this.#session);
		const found = (this.#resumes.get(session.userId) ?? []).find((item) => item.id === id);
		if (!found) throw new ApiError('not_found', '找不到这份简历');
		return {
			text: mockOptimize(found.content.name ?? '求职者', found.content.title ?? '相关岗位'),
			disclaimer: HUSTLE_DISCLAIMER,
			source: 'mock'
		};
	}

	async createSideHustle(input: {
		id?: string;
		title: string;
		platform: string;
		estimatedIncome: number;
		skillsRequired: string[];
		kind: SideHustle['kind'];
		hoursPerWeek?: number;
	}): Promise<SideHustle> {
		const session = requireSession(this.#session);
		if (!input.title.trim() || !input.platform.trim()) {
			throw new ApiError('invalid_request', '请填写标题和平台');
		}
		if (!['线上', '线下', '技能型'].includes(input.kind) || input.estimatedIncome < 0) {
			throw new ApiError('invalid_request', '副业信息不完整');
		}
		const list = hydrateUserList(this.#hustles, HUSTLES_KEY, session.userId, []);
		const id = input.id ?? crypto.randomUUID();
		const existing = list.find((item) => item.id === id);
		if (existing) return existing;
		const row: SideHustle = {
			id,
			title: input.title.trim(),
			platform: input.platform.trim(),
			estimatedIncome: input.estimatedIncome,
			skillsRequired: input.skillsRequired,
			kind: input.kind,
			hoursPerWeek: input.hoursPerWeek ?? null,
			createdAt: new Date().toISOString()
		};
		persistUserList(this.#hustles, HUSTLES_KEY, session.userId, [row, ...list]);
		return row;
	}

	async listSideHustles(kind?: SideHustle['kind']): Promise<SideHustle[]> {
		const session = requireSession(this.#session);
		this.#hydrateHustle(session.userId);
		return filterSideHustles(this.#hustles.get(session.userId) ?? [], kind);
	}

	async suggestSideHustles(input: {
		skills: string[];
		hoursPerWeek: number;
	}): Promise<SideHustleSuggest> {
		requireSession(this.#session);
		return {
			items: mockSuggestions(input.skills, input.hoursPerWeek),
			disclaimer: HUSTLE_DISCLAIMER,
			source: 'mock'
		};
	}

	async listHustleQuestions(filter?: {
		role?: string;
		difficulty?: string;
	}): Promise<InterviewQuestion[]> {
		requireSession(this.#session);
		if (filter?.role && !(INTERVIEW_ROLES as readonly string[]).includes(filter.role)) {
			throw new ApiError('invalid_request', '未知方向');
		}
		if (
			filter?.difficulty &&
			!(INTERVIEW_DIFFICULTIES as readonly string[]).includes(filter.difficulty)
		) {
			throw new ApiError('invalid_request', '未知难度');
		}
		return filterQuestions(INTERVIEW_QUESTIONS, filter);
	}

	async mockInterview(input: { questionId?: string; question?: string }): Promise<HustleAiText> {
		requireSession(this.#session);
		const fromId = INTERVIEW_QUESTIONS.find((item) => item.id === input.questionId);
		const question = fromId?.prompt ?? input.question?.trim() ?? '';
		if (!question) throw new ApiError('invalid_request', '请选择一道题');
		return {
			question,
			text: mockInterviewer(question),
			disclaimer: HUSTLE_DISCLAIMER,
			source: 'mock'
		};
	}

	#withCounts(service: LocalService): LocalService {
		const counts = { 已搬迁: 0, 电话空号: 0 } as Record<CorrectionKind, number>;
		for (const row of this.#corrections.filter((item) => item.serviceId === service.id)) {
			counts[row.kind] += 1;
		}
		return { ...service, correctionCounts: counts };
	}

	async listLocalServices(filter?: {
		q?: string;
		category?: LocalCategory;
		tag?: ElderTag;
		sort?: LocalSort;
		lat?: number;
		lng?: number;
	}): Promise<LocalService[]> {
		requireSession(this.#session);
		if (filter?.sort && filter.sort !== 'distance' && filter.sort !== 'rating') {
			throw new ApiError('invalid_request', '无法这样排序');
		}
		if (filter?.category && !CATEGORIES.includes(filter.category)) {
			throw new ApiError('invalid_request', '请选择分类');
		}
		if (filter?.tag && !ELDER_TAGS.includes(filter.tag)) {
			throw new ApiError('invalid_request', '标签不在适老清单里');
		}
		const origin = {
			lat: filter?.lat ?? COMMUNITY_ORIGIN.lat,
			lng: filter?.lng ?? COMMUNITY_ORIGIN.lng
		};
		const found = searchServices(this.#services, {
			q: filter?.q,
			category: filter?.category,
			tag: filter?.tag
		});
		return sortServices(found, filter?.sort ?? 'distance', origin).map((item) =>
			this.#withCounts(item)
		);
	}

	async getLocalService(id: string): Promise<LocalService> {
		requireSession(this.#session);
		const found = this.#services.find((item) => item.id === id);
		if (!found) throw new ApiError('not_found', '找不到这家店');
		return this.#withCounts(found);
	}

	async createLocalService(input: {
		id?: string;
		name: string;
		category: LocalCategory;
		address: string;
		latitude: number;
		longitude: number;
		hours?: string;
		phone?: string;
		tags?: ElderTag[];
	}): Promise<LocalService> {
		const session = requireSession(this.#session);
		const checked = validatePublish({
			name: input.name,
			category: input.category,
			address: input.address,
			latitude: input.latitude,
			longitude: input.longitude,
			hours: input.hours,
			phone: input.phone,
			tags: input.tags
		});
		if (!checked.ok) throw new ApiError(checked.code, checked.message);
		const id = input.id ?? crypto.randomUUID();
		const existing = this.#services.find((item) => item.id === id);
		if (existing) return this.#withCounts(existing);
		const row: LocalService = {
			id,
			name: checked.value.name,
			category: checked.value.category,
			address: checked.value.address,
			latitude: input.latitude,
			longitude: input.longitude,
			tags: (checked.value.tags ?? []) as ElderTag[],
			ratingAvg: 0,
			hours: input.hours,
			phone: input.phone,
			createdBy: session.userId,
			createdAt: new Date().toISOString()
		};
		this.#services = [row, ...this.#services];
		return this.#withCounts(row);
	}

	async listLocalReviews(serviceId: string): Promise<LocalReview[]> {
		requireSession(this.#session);
		await this.getLocalService(serviceId);
		return this.#reviews
			.filter((item) => item.serviceId === serviceId)
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	}

	async createLocalReview(
		serviceId: string,
		input: { id?: string; content: string; rating?: number; images?: string[] }
	): Promise<LocalReview> {
		const session = requireSession(this.#session);
		await this.getLocalService(serviceId);
		const checked = validateReview({ content: input.content, rating: input.rating });
		if (!checked.ok) throw new ApiError(checked.code, checked.message);
		const id = input.id ?? crypto.randomUUID();
		const existing = this.#reviews.find((item) => item.id === id);
		if (existing) return existing;
		const row: LocalReview = {
			id,
			serviceId,
			userId: session.userId,
			content: checked.value.content,
			rating: input.rating,
			images: input.images ?? [],
			createdAt: new Date().toISOString()
		};
		this.#reviews = [row, ...this.#reviews];
		const rated = this.#reviews.filter(
			(item) => item.serviceId === serviceId && item.rating != null
		);
		if (rated.length) {
			const avg = rated.reduce((sum, item) => sum + (item.rating ?? 0), 0) / rated.length;
			this.#services = this.#services.map((item) =>
				item.id === serviceId ? { ...item, ratingAvg: avg } : item
			);
		}
		return row;
	}

	async createLocalCorrection(
		serviceId: string,
		input: { id?: string; kind: CorrectionKind }
	): Promise<LocalCorrection> {
		const session = requireSession(this.#session);
		await this.getLocalService(serviceId);
		const checked = validateCorrection(input.kind);
		if (!checked.ok) throw new ApiError(checked.code, checked.message);
		const id = input.id ?? crypto.randomUUID();
		const existing = this.#corrections.find((item) => item.id === id);
		if (existing) return existing;
		const row: LocalCorrection = {
			id,
			serviceId,
			userId: session.userId,
			kind: checked.value,
			createdAt: new Date().toISOString()
		};
		this.#corrections = [row, ...this.#corrections];
		return row;
	}

	async listCreations(): Promise<Creation[]> {
		const session = requireSession(this.#session);
		this.#hydrateCreate(session.userId);
		return [...(this.#creations.get(session.userId) ?? [])];
	}

	async createCreation(input: {
		id?: string;
		platform: CreatePlatform;
		title?: string;
		promptParams?: Record<string, unknown>;
		generatedContent: string;
		finalContent?: string;
	}): Promise<Creation> {
		const session = requireSession(this.#session);
		if (!isCreatePlatform(input.platform)) {
			throw new ApiError('invalid_request', '未知平台');
		}
		const generated = input.generatedContent.trim();
		if (!generated) throw new ApiError('invalid_request', '请先生成文案');
		this.#hydrateCreate(session.userId);
		const list = this.#creations.get(session.userId) ?? [];
		const id = input.id ?? crypto.randomUUID();
		const existing = list.find((item) => item.id === id);
		if (existing) return existing;
		const now = new Date().toISOString();
		const finalContent = input.finalContent?.trim() || generated;
		const topic =
			typeof input.promptParams?.topic === 'string' ? input.promptParams.topic : undefined;
		const versions = [{ at: now, kind: 'generate', content: generated }];
		if (finalContent !== generated) {
			versions.push({ at: now, kind: 'edit', content: finalContent });
		}
		const work: Creation = {
			id,
			platform: input.platform,
			title: input.title?.trim() || topic,
			promptParams: input.promptParams,
			generatedContent: generated,
			finalContent,
			versions,
			createdAt: now,
			updatedAt: now
		};
		persistUserList(this.#creations, CREATIONS_KEY, session.userId, [work, ...list]);
		return work;
	}

	async getCreation(id: string): Promise<Creation> {
		const session = requireSession(this.#session);
		this.#hydrateCreate(session.userId);
		const found = (this.#creations.get(session.userId) ?? []).find((item) => item.id === id);
		if (!found) throw new ApiError('not_found', '未找到作品');
		return found;
	}

	async patchCreation(
		id: string,
		patch: {
			title?: string;
			generatedContent?: string;
			finalContent?: string;
			promptParams?: Record<string, unknown>;
		}
	): Promise<Creation> {
		const session = requireSession(this.#session);
		this.#hydrateCreate(session.userId);
		const list = this.#creations.get(session.userId) ?? [];
		const index = list.findIndex((item) => item.id === id);
		if (index < 0) throw new ApiError('not_found', '未找到作品');
		const now = new Date().toISOString();
		const current = { ...list[index], versions: [...list[index].versions] };
		if (patch.title !== undefined) current.title = patch.title.trim() || null;
		if (patch.promptParams) current.promptParams = patch.promptParams;
		if (patch.generatedContent !== undefined) {
			const text = patch.generatedContent.trim();
			if (!text) throw new ApiError('invalid_request', '请填写生成稿');
			if (text !== current.generatedContent) {
				current.generatedContent = text;
				current.versions.push({ at: now, kind: 'generate', content: text });
			}
		}
		if (patch.finalContent !== undefined) {
			const text = patch.finalContent.trim();
			if (!text) throw new ApiError('invalid_request', '请填写定稿');
			if (text !== current.finalContent) {
				current.finalContent = text;
				current.versions.push({ at: now, kind: 'edit', content: text });
			}
		}
		current.updatedAt = now;
		const next = [...list];
		next[index] = current;
		persistUserList(this.#creations, CREATIONS_KEY, session.userId, next);
		return current;
	}

	async listCreateTemplates(platform?: CreatePlatform) {
		requireSession(this.#session);
		if (platform && !isCreatePlatform(platform)) {
			throw new ApiError('invalid_request', '未知平台');
		}
		return filterTemplates(TEMPLATES, platform);
	}

	async listCreateInspiration() {
		requireSession(this.#session);
		return [...INSPIRATION];
	}

	async generateCreateCopy(input: {
		platform: CreatePlatform;
		topic: string;
		keywords?: string[];
		tone?: CreateTone;
		length?: CreateLength;
		templateId?: string;
	}): Promise<CreateAiText> {
		requireSession(this.#session);
		if (!isCreatePlatform(input.platform)) {
			throw new ApiError('invalid_request', '未知平台');
		}
		if (!input.topic.trim()) throw new ApiError('invalid_request', '请填写主题');
		const tone = input.tone ?? '更专业';
		const length = input.length ?? '中';
		if (!isCreateTone(tone)) throw new ApiError('invalid_request', '未知语气');
		return {
			text: mockGenerate({
				platform: input.platform,
				topic: input.topic.trim(),
				keywords: input.keywords ?? [],
				tone,
				length
			}),
			disclaimer: CREATE_DISCLAIMER,
			source: 'mock'
		};
	}

	async generateCreateTitles(input: {
		topic: string;
		platform?: CreatePlatform;
	}): Promise<CreateTitles> {
		requireSession(this.#session);
		if (!input.topic.trim()) throw new ApiError('invalid_request', '请填写主题');
		if (input.platform && !isCreatePlatform(input.platform)) {
			throw new ApiError('invalid_request', '未知平台');
		}
		return {
			titles: mockTitles(input.topic.trim()),
			disclaimer: CREATE_DISCLAIMER,
			source: 'mock'
		};
	}

	async polishCreateCopy(input: { text: string; tone: CreateTone }): Promise<CreateAiText> {
		requireSession(this.#session);
		if (!input.text.trim()) throw new ApiError('invalid_request', '请填写原文');
		if (!isCreateTone(input.tone)) throw new ApiError('invalid_request', '未知语气');
		return {
			text: mockPolish(input.text.trim(), input.tone),
			disclaimer: CREATE_DISCLAIMER,
			source: 'mock'
		};
	}

	async generateCreateOutline(input: { topic: string }): Promise<CreateOutlineResult> {
		requireSession(this.#session);
		if (!input.topic.trim()) throw new ApiError('invalid_request', '请填写主题');
		const outline = mockOutline(input.topic.trim());
		return {
			...outline,
			markdown: outline.markdown ?? '',
			disclaimer: CREATE_DISCLAIMER,
			source: 'mock'
		};
	}

	async listCreateSnippets(): Promise<CreateSnippet[]> {
		const session = requireSession(this.#session);
		this.#hydrateCreate(session.userId);
		return [...(this.#snippets.get(session.userId) ?? [])];
	}

	async createSnippet(input: {
		id?: string;
		content: string;
		kind?: SnippetKind;
		tags?: string[];
	}): Promise<CreateSnippet> {
		const session = requireSession(this.#session);
		const content = input.content.trim();
		if (!content) throw new ApiError('invalid_request', '请填写片段');
		const kind = input.kind ?? '金句';
		if (!isSnippetKind(kind)) throw new ApiError('invalid_request', '未知类型');
		this.#hydrateCreate(session.userId);
		const list = this.#snippets.get(session.userId) ?? [];
		const id = input.id ?? crypto.randomUUID();
		const existing = list.find((item) => item.id === id);
		if (existing) return existing;
		const now = new Date().toISOString();
		const row: CreateSnippet = {
			id,
			content,
			kind,
			tags: input.tags ?? [],
			usageCount: 0,
			createdAt: now,
			updatedAt: now
		};
		persistUserList(this.#snippets, SNIPPETS_KEY, session.userId, [row, ...list]);
		return row;
	}

	async useSnippet(id: string): Promise<CreateSnippet> {
		const session = requireSession(this.#session);
		this.#hydrateCreate(session.userId);
		const list = this.#snippets.get(session.userId) ?? [];
		const index = list.findIndex((item) => item.id === id);
		if (index < 0) throw new ApiError('not_found', '未找到片段');
		const next = [...list];
		next[index] = {
			...next[index],
			usageCount: next[index].usageCount + 1,
			updatedAt: new Date().toISOString()
		};
		persistUserList(this.#snippets, SNIPPETS_KEY, session.userId, next);
		return next[index];
	}

	async listTools(): Promise<ToolCatalog> {
		const session = requireSession(this.#session);
		this.#hydrateTools(session.userId);
		const templates = this.#aiTemplates.get(session.userId) ?? [];
		const tasks = this.#aiTasks.get(session.userId) ?? [];
		const favourites = templates.filter((item) => item.favourite).map((item) => item.toolId);
		const seen = new Set<ToolId>();
		const recent: ToolId[] = [];
		for (const task of [...tasks].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))) {
			if (!seen.has(task.toolId)) {
				seen.add(task.toolId);
				recent.push(task.toolId);
			}
		}
		return mergeCatalog(favourites, recent);
	}

	async setToolFavourite(toolId: ToolId, favourite: boolean) {
		const session = requireSession(this.#session);
		if (!isToolId(toolId)) throw new ApiError('invalid_request', '未知工具');
		this.#hydrateTools(session.userId);
		const list = this.#aiTemplates.get(session.userId) ?? [];
		const now = new Date().toISOString();
		const index = list.findIndex((item) => item.toolId === toolId);
		if (index >= 0) {
			const next = [...list];
			next[index] = { ...next[index], favourite, updatedAt: now };
			persistUserList(this.#aiTemplates, AI_TEMPLATES_KEY, session.userId, next);
		} else {
			persistUserList(this.#aiTemplates, AI_TEMPLATES_KEY, session.userId, [
				{
					id: crypto.randomUUID(),
					toolId,
					title: toolId,
					body: '',
					favourite,
					createdAt: now,
					updatedAt: now
				},
				...list
			]);
		}
		return { toolId, favourite };
	}

	async listAiTasks(toolId?: ToolId): Promise<AiTask[]> {
		const session = requireSession(this.#session);
		if (toolId && !isToolId(toolId)) throw new ApiError('invalid_request', '未知工具');
		this.#hydrateTools(session.userId);
		const list = [...(this.#aiTasks.get(session.userId) ?? [])].sort((a, b) =>
			a.createdAt < b.createdAt ? 1 : -1
		);
		return toolId ? list.filter((item) => item.toolId === toolId) : list;
	}

	async getAiTask(id: string): Promise<AiTask> {
		const session = requireSession(this.#session);
		this.#hydrateTools(session.userId);
		const found = (this.#aiTasks.get(session.userId) ?? []).find((item) => item.id === id);
		if (!found) throw new ApiError('not_found', '未找到记录');
		return found;
	}

	async *runTool(input: ToolRunInput): AsyncIterable<ToolStreamEvent> {
		const session = requireSession(this.#session);
		if (!isToolId(input.toolId)) throw new ApiError('invalid_request', '未知工具');
		this.#hydrateTools(session.userId);
		if (input.toolId === 'summary') {
			const kind = input.inputKind ?? 'text';
			if (kind === 'text' && !(input.text ?? '').trim() && !input.url) {
				throw new ApiError('invalid_request', '请输入内容');
			}
			if (kind === 'url' && !(input.url ?? '').trim()) {
				throw new ApiError('invalid_request', '请输入链接');
			}
		}
		if (input.toolId === 'meeting' && !(input.text ?? '').trim()) {
			throw new ApiError('invalid_request', '请输入会议记录');
		}
		if (
			['writing.weekly', 'writing.daily', 'writing.xhs', 'polish'].includes(input.toolId) &&
			!(input.text ?? '').trim()
		) {
			throw new ApiError('invalid_request', '请输入内容');
		}
		if (input.toolId === 'polish' && input.tone && !POLISH_TONES.includes(input.tone)) {
			throw new ApiError('invalid_request', '未知语气');
		}
		if (
			input.toolId === 'resume_jd' &&
			(!(input.resume ?? '').trim() || !(input.jd ?? '').trim())
		) {
			throw new ApiError('invalid_request', '请同时提供简历和职位');
		}
		if (input.toolId === 'rename' && !(input.filenames ?? []).some((name) => name.trim())) {
			throw new ApiError('invalid_request', '请提供文件名');
		}
		if (input.toolId === 'meeting' && input.step === 'decisions') {
			const prior = (this.#aiTasks.get(session.userId) ?? []).find(
				(item) => item.toolId === 'meeting'
			);
			const topics = input.topics?.length
				? input.topics
				: ((prior?.outputJson.topics as string[] | undefined) ?? []);
			if (!topics.length) throw new ApiError('invalid_request', '请先生成议题');
			input = { ...input, topics };
		}
		const generated = mockRun(input.toolId, input);
		const now = new Date().toISOString();
		const task: AiTask = {
			id: crypto.randomUUID(),
			toolId: input.toolId,
			inputKind: input.inputKind ?? 'text',
			inputText: input.text ?? input.resume ?? (input.filenames ?? []).join('\n'),
			inputMeta: {
				url: input.url,
				filename: input.filename,
				tone: input.tone,
				step: input.step
			},
			outputText: generated.outputText,
			outputJson: generated.outputJson,
			source: 'mock',
			disclaimer: TOOLS_DISCLAIMER,
			createdAt: now
		};
		const list = this.#aiTasks.get(session.userId) ?? [];
		persistUserList(this.#aiTasks, AI_TASKS_KEY, session.userId, [task, ...list]);
		for (const text of chunkText(task.outputText, 10)) {
			yield { type: 'delta', text };
			await Promise.resolve();
		}
		yield { type: 'result', task };
	}

	async listFinanceCategories() {
		return this.#mod.listFinanceCategories();
	}
	async createFinanceTransaction(input: FinanceTxInput) {
		return this.#mod.createFinanceTransaction(input);
	}
	async listFinanceTransactions(month?: string) {
		return this.#mod.listFinanceTransactions(month);
	}
	async getFinanceSummary(month: string) {
		return this.#mod.getFinanceSummary(month);
	}
	async getFinanceReport(month: string) {
		return this.#mod.getFinanceReport(month);
	}
	async listFinanceBudgets() {
		return this.#mod.listFinanceBudgets();
	}
	async putFinanceBudgets(items: FinanceBudgetInput[]) {
		return this.#mod.putFinanceBudgets(items);
	}
	async listFinanceSubscriptions() {
		return this.#mod.listFinanceSubscriptions();
	}
	async listUpcomingSubscriptions() {
		return this.#mod.listUpcomingSubscriptions();
	}
	async createFinanceSubscription(input: FinanceSubInput) {
		return this.#mod.createFinanceSubscription(input);
	}
	async deleteFinanceSubscription(id: string) {
		return this.#mod.deleteFinanceSubscription(id);
	}
	async listFinanceChallenges() {
		return this.#mod.listFinanceChallenges();
	}
	async createFinanceChallenge(input: FinanceChallengeInput) {
		return this.#mod.createFinanceChallenge(input);
	}
	async checkinFinanceChallenge(id: string, day: string) {
		return this.#mod.checkinFinanceChallenge(id, day);
	}
	async deleteFinanceChallenge(id: string) {
		return this.#mod.deleteFinanceChallenge(id);
	}
	async createJob(input: { runAt: string; title: string; body: string }) {
		return this.#mod.createJob(input);
	}
	async getElderToday(elderId?: string) {
		return this.#mod.getElderToday(elderId);
	}
	async listElderReminders(elderId?: string) {
		return this.#mod.listElderReminders(elderId);
	}
	async createElderReminder(input: ElderReminderInput, elderId?: string) {
		return this.#mod.createElderReminder(input, elderId);
	}
	async ackElderReminder(id: string, occurrenceAt: string, elderId?: string) {
		return this.#mod.ackElderReminder(id, occurrenceAt, elderId);
	}
	async listElderContacts(elderId?: string) {
		return this.#mod.listElderContacts(elderId);
	}
	async getElderProfile(elderId?: string) {
		return this.#mod.getElderProfile(elderId);
	}
	async patchElderProfile(
		input: { activityLogOptIn?: boolean; timezone?: string },
		elderId?: string
	) {
		return this.#mod.patchElderProfile(input, elderId);
	}
	async getWellnessToday() {
		return this.#mod.getWellnessToday();
	}
	async addWellnessWater(ml: number, loggedOn: string) {
		return this.#mod.addWellnessWater(ml, loggedOn);
	}
	async listWellnessWater() {
		return this.#mod.listWellnessWater();
	}
	async addWellnessSleep(input: {
		sleepAt: string;
		wakeAt: string;
		quality: number;
		note?: string | null;
	}) {
		return this.#mod.addWellnessSleep(input);
	}
	async listWellnessSleep() {
		return this.#mod.listWellnessSleep();
	}
	async putWellnessConsent(cycleConsent: boolean) {
		return this.#mod.putWellnessConsent(cycleConsent);
	}
	async addWellnessCycle(input: {
		startDate: string;
		endDate?: string | null;
		flowLevel?: CycleLog['flowLevel'];
		symptoms?: string | null;
	}) {
		return this.#mod.addWellnessCycle(input);
	}
	async listWellnessCycles() {
		return this.#mod.listWellnessCycles();
	}
	async addWellnessReport(input: {
		title: string;
		reportDate: string;
		metrics: ReportLog['metrics'];
	}) {
		return this.#mod.addWellnessReport(input);
	}
	async listWellnessReports() {
		return this.#mod.listWellnessReports();
	}
	async createWellnessPlan(kind: PlanLog['kind']) {
		return this.#mod.createWellnessPlan(kind);
	}
	async listWellnessPlans() {
		return this.#mod.listWellnessPlans();
	}
	async checkinWellnessPlan(id: string, day: string) {
		return this.#mod.checkinWellnessPlan(id, day);
	}
	async listWellnessReminders() {
		return this.#mod.listWellnessReminders();
	}
	async createWellnessReminder(input: {
		kind: ReminderLog['kind'];
		time: string;
		daysOfWeek: number[];
	}) {
		return this.#mod.createWellnessReminder(input);
	}
}

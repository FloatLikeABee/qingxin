import { MODULES } from '../modules';
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
import { BEDTIME_STORIES, SOUND_PRESETS } from '../mood/catalog';
import { DISCLAIMER, mockInsight } from '../mood/insight';
import { aggregateTrends, type MoodLog } from '../mood/trends';
import { validateCheckIn } from '../mood/validate';
import {
	ApiError,
	type ExportPayload,
	type HustleAiText,
	type MeditationKind,
	type MeditationSession,
	type MoodInsight,
	type QingxinApi,
	type ResumeVersion,
	type Session,
	type SideHustleSuggest
} from './types';

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
	userId: string
) {
	logs.delete(userId);
	sessions.delete(userId);
	apps.delete(userId);
	resumes.delete(userId);
	hustles.delete(userId);
	for (const key of [LOGS_KEY, SESSIONS_KEY, APPS_KEY, RESUMES_KEY, HUSTLES_KEY]) {
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

	#hydrateHustle(userId: string) {
		hydrateUserList(this.#apps, APPS_KEY, userId, seedApplications());
		hydrateUserList(this.#resumes, RESUMES_KEY, userId, seedResumes(userId));
		hydrateUserList(this.#hustles, HUSTLES_KEY, userId, SEED_SIDE_HUSTLES);
	}

	async getSession(): Promise<Session | null> {
		this.#session ??= readStoredSession();
		if (this.#session) {
			hydrateUserList(this.#logs, LOGS_KEY, this.#session.userId, seedLogs(this.#session.userId));
			hydrateUserList(this.#sessions, SESSIONS_KEY, this.#session.userId, []);
			this.#hydrateHustle(this.#session.userId);
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
				sideHustles: [...(this.#hustles.get(session.userId) ?? [])]
			}
		};
	}

	async deleteAccount(): Promise<void> {
		if (this.#session) {
			forgetUserLists(
				this.#logs,
				this.#sessions,
				this.#apps,
				this.#resumes,
				this.#hustles,
				this.#session.userId
			);
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
}

let singleton: QingxinApi | undefined;

export function getApi(): QingxinApi {
	singleton ??= new MockQingxinApi();
	return singleton;
}

export function resetApi(next: QingxinApi = new MockQingxinApi()) {
	singleton = next;
}

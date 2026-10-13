import { MODULES } from '../modules';
import { BEDTIME_STORIES, SOUND_PRESETS } from '../mood/catalog';
import { DISCLAIMER, mockInsight } from '../mood/insight';
import { aggregateTrends, type MoodLog } from '../mood/trends';
import { validateCheckIn } from '../mood/validate';
import {
	ApiError,
	type ExportPayload,
	type MeditationKind,
	type MeditationSession,
	type MoodInsight,
	type QingxinApi,
	type Session
} from './types';

export { ApiError } from './types';
export type { QingxinApi, Session } from './types';

const DEMO_EMAIL = 'demo@qingxin.app';
const DEMO_PASSWORD = 'qingxin';
const SESSION_KEY = 'qingxin.session';

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

	async getSession(): Promise<Session | null> {
		this.#session ??= readStoredSession();
		if (this.#session && !this.#logs.has(this.#session.userId)) {
			this.#logs.set(this.#session.userId, seedLogs(this.#session.userId));
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
		if (!this.#logs.has(this.#session.userId)) {
			this.#logs.set(this.#session.userId, seedLogs(this.#session.userId));
		}
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
		this.#logs.set(this.#session.userId, []);
		this.#sessions.set(this.#session.userId, []);
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
				meditationSessions: [...(this.#sessions.get(session.userId) ?? [])]
			}
		};
	}

	async deleteAccount(): Promise<void> {
		if (this.#session) {
			this.#logs.delete(this.#session.userId);
			this.#sessions.delete(this.#session.userId);
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
		const log: MoodLog = {
			id: input.id ?? crypto.randomUUID(),
			emoji: checked.value.emoji,
			score: checked.value.score,
			tags: checked.value.tags,
			note: checked.value.note,
			createdAt: new Date().toISOString()
		};
		const list = this.#logs.get(session.userId) ?? [];
		this.#logs.set(session.userId, [log, ...list]);
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
			const found = (this.#logs.get(session.userId) ?? []).find((item) => item.id === input.moodLogId);
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
			? `这个月记下了${inMonth.length}笔。${mockInsight(inMonth[0]?.emoji ?? '😐', inMonth.flatMap((item) => item.tags))}`
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
		kind: MeditationKind;
		durationSec: number;
		payload?: Record<string, unknown>;
	}): Promise<MeditationSession> {
		const session = requireSession(this.#session);
		if (!KINDS.includes(input.kind) || input.durationSec < 0) {
			throw new ApiError('invalid_request', '无法保存这次练习');
		}
		const row: MeditationSession = {
			id: crypto.randomUUID(),
			kind: input.kind,
			durationSec: input.durationSec,
			payload: input.payload ?? {},
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString()
		};
		const list = this.#sessions.get(session.userId) ?? [];
		this.#sessions.set(session.userId, [row, ...list]);
		return row;
	}

	async listMeditationSessions(): Promise<MeditationSession[]> {
		const session = requireSession(this.#session);
		return [...(this.#sessions.get(session.userId) ?? [])];
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

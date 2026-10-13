import { MODULES } from '../modules';
import type { InterviewQuestion, SideHustle } from '../hustle/catalog';
import type { Application, FunnelStage } from '../hustle/funnel';
import type { ResumeContent } from '../hustle/resume';
import type {
	CreateLength,
	CreatePlatform,
	CreateTemplate,
	CreateTone,
	Inspiration,
	SnippetKind
} from '../create/catalog';
import { mergeCatalog, type ToolId } from '../tools/catalog';
import type {
	CorrectionKind,
	ElderTag,
	LocalCategory,
	LocalCorrection,
	LocalReview,
	LocalService
} from '../local/catalog';
import type { LocalSort } from '../local/geo';
import type { MoodLog } from '../mood/trends';
import {
	ApiError,
	type AiTask,
	type CreateAiText,
	type CreateMoodLogInput,
	type CreateOutlineResult,
	type CreateSnippet,
	type CreateTitles,
	type Creation,
	type ExportPayload,
	type HustleAiText,
	type MeditationCatalog,
	type MeditationKind,
	type MeditationSession,
	type MoodInsight,
	type QingxinApi,
	type ResumeVersion,
	type Session,
	type SideHustleSuggest,
	type ToolCatalog,
	type ToolRunInput,
	type ToolStreamEvent
} from './types';
import { createHttpModules } from './http-modules';
import type { ElderReminderInput } from '../elder/payload';
import type {
	FinanceBudgetInput,
	FinanceChallengeInput,
	FinanceSubInput,
	FinanceTxInput
} from '../finance/payload';
import type { CycleLog, PlanLog, ReminderLog, ReportLog } from '../wellness/types';

export const PRIVACY_POLICY_VERSION = '2026-10-13';
const SESSION_KEY = 'qingxin.session';

export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export interface HttpQingxinApiOptions {
	baseUrl: string;
	fetch?: typeof fetch;
	storage?: StorageLike;
	policyVersion?: string;
}

type Json = Record<string, unknown>;

function dropSlash(url: string): string {
	return url.replace(/\/+$/, '');
}

function asJson(value: unknown): Json {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};
}

function str(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function strList(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === 'string')
		: [];
}

function itemsOf(value: unknown): unknown[] {
	const rec = asJson(value);
	if (Array.isArray(rec.items)) return rec.items;
	return Array.isArray(value) ? value : [];
}

function compact(record: Json): Json {
	const next: Json = {};
	for (const [key, value] of Object.entries(record)) {
		if (value !== undefined) next[key] = value;
	}
	return next;
}

function queryString(params: Record<string, string | number | undefined>): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === '') continue;
		search.set(key, String(value));
	}
	const text = search.toString();
	return text ? `?${text}` : '';
}

function sourceOf(value: unknown): 'mock' | 'gateway' {
	return value === 'gateway' ? 'gateway' : 'mock';
}

function defaultStorage(): StorageLike {
	try {
		if (globalThis.localStorage) return globalThis.localStorage;
	} catch {
		/* private mode */
	}
	const memory = new Map<string, string>();
	return {
		getItem: (key) => memory.get(key) ?? null,
		setItem: (key, value) => {
			memory.set(key, value);
		},
		removeItem: (key) => {
			memory.delete(key);
		}
	};
}

function mapSession(tokens: Json): Session {
	const user = asJson(tokens.user);
	return {
		userId: str(user.id),
		displayName: str(user.display_name),
		email: str(user.email),
		token: str(tokens.access_token),
		refreshToken: str(tokens.refresh_token)
	};
}

function mapMoodLog(value: unknown): MoodLog {
	const row = asJson(value);
	return {
		id: str(row.id),
		emoji: str(row.emoji),
		score: num(row.score),
		tags: strList(row.tags),
		note: row.note == null ? null : str(row.note),
		createdAt: str(row.created_at)
	};
}

function mapInsight(value: unknown): MoodInsight {
	const row = asJson(value);
	return {
		text: str(row.text),
		disclaimer: str(row.disclaimer),
		source: sourceOf(row.source),
		month: row.month == null ? undefined : str(row.month)
	};
}

function mapMeditation(value: unknown): MeditationSession {
	const row = asJson(value);
	return {
		id: str(row.id),
		kind: str(row.kind) as MeditationKind,
		durationSec: num(row.duration_sec),
		payload: asJson(row.payload),
		startedAt: str(row.started_at),
		endedAt: row.ended_at == null ? null : str(row.ended_at)
	};
}

function mapApplication(value: unknown): Application {
	const row = asJson(value);
	const status = str(row.status);
	return {
		id: str(row.id),
		company: str(row.company),
		position: str(row.position),
		status: status === '面试' || status === 'Offer' ? status : '投递',
		interviewDate: row.interview_date == null ? null : str(row.interview_date),
		notes: row.notes == null ? null : str(row.notes),
		createdAt: str(row.created_at) || undefined,
		updatedAt: str(row.updated_at) || undefined
	};
}

function mapResume(value: unknown): ResumeVersion {
	const row = asJson(value);
	return {
		id: str(row.id),
		version: num(row.version, 1),
		title: row.title == null ? null : str(row.title),
		content: (row.content ?? {}) as ResumeContent,
		pdfUrl: row.pdf_url == null ? null : str(row.pdf_url),
		createdAt: str(row.created_at),
		updatedAt: str(row.updated_at)
	};
}

function mapHustle(value: unknown): SideHustle {
	const row = asJson(value);
	const kind = str(row.kind);
	return {
		id: str(row.id),
		title: str(row.title),
		platform: str(row.platform),
		estimatedIncome: num(row.estimated_income),
		skillsRequired: strList(row.skills_required),
		kind: kind === '线下' || kind === '技能型' ? kind : '线上',
		hoursPerWeek: row.hours_per_week == null ? null : num(row.hours_per_week),
		createdAt: str(row.created_at) || undefined
	};
}

function mapQuestion(value: unknown): InterviewQuestion {
	const row = asJson(value);
	return {
		id: str(row.id),
		role: str(row.role) as InterviewQuestion['role'],
		difficulty: str(row.difficulty) as InterviewQuestion['difficulty'],
		prompt: str(row.prompt)
	};
}

function mapAiText(value: unknown): HustleAiText {
	const row = asJson(value);
	return {
		text: str(row.text),
		disclaimer: str(row.disclaimer),
		source: sourceOf(row.source),
		question: row.question == null ? undefined : str(row.question)
	};
}

function mapService(value: unknown): LocalService {
	const row = asJson(value);
	return {
		id: str(row.id),
		name: str(row.name),
		category: str(row.category) as LocalCategory,
		latitude: num(row.latitude),
		longitude: num(row.longitude),
		address: str(row.address),
		tags: strList(row.tags) as ElderTag[],
		ratingAvg: num(row.rating_avg),
		hours: row.hours == null ? null : str(row.hours),
		phone: row.phone == null ? null : str(row.phone),
		heroKey: row.hero_key == null ? null : (str(row.hero_key) as LocalService['heroKey']),
		createdAt: str(row.created_at) || undefined,
		createdBy: row.created_by == null ? null : str(row.created_by),
		distanceM: row.distance_m == null ? undefined : num(row.distance_m),
		correctionCounts: (row.correction_counts ?? undefined) as LocalService['correctionCounts']
	};
}

function mapReview(value: unknown): LocalReview {
	const row = asJson(value);
	return {
		id: str(row.id),
		serviceId: str(row.service_id),
		userId: str(row.user_id),
		content: str(row.content),
		rating: row.rating == null ? null : num(row.rating),
		images: strList(row.images),
		createdAt: str(row.created_at)
	};
}

function mapCorrection(value: unknown): LocalCorrection {
	const row = asJson(value);
	return {
		id: str(row.id),
		serviceId: str(row.service_id),
		userId: str(row.user_id),
		kind: str(row.kind) as CorrectionKind,
		createdAt: str(row.created_at)
	};
}

function mapCreation(value: unknown): Creation {
	const row = asJson(value);
	const versions = Array.isArray(row.versions) ? row.versions : [];
	return {
		id: str(row.id),
		platform: str(row.platform) as CreatePlatform,
		title: row.title == null ? null : str(row.title),
		promptParams: asJson(row.prompt_params),
		generatedContent: str(row.generated_content),
		finalContent: str(row.final_content),
		versions: versions.map((item) => {
			const ver = asJson(item);
			return { at: str(ver.at), kind: str(ver.kind), content: str(ver.content) };
		}),
		createdAt: str(row.created_at),
		updatedAt: str(row.updated_at)
	};
}

function mapSnippet(value: unknown): CreateSnippet {
	const row = asJson(value);
	return {
		id: str(row.id),
		content: str(row.content),
		kind: str(row.kind) as SnippetKind,
		tags: strList(row.tags),
		usageCount: num(row.usage_count),
		createdAt: str(row.created_at),
		updatedAt: str(row.updated_at)
	};
}

function mapTask(value: unknown): AiTask {
	const row = asJson(value);
	return {
		id: str(row.id),
		toolId: str(row.tool_id) as ToolId,
		inputKind: str(row.input_kind),
		inputText: str(row.input_text),
		inputMeta: asJson(row.input_meta),
		outputText: str(row.output_text),
		outputJson: asJson(row.output_json),
		source: sourceOf(row.source),
		disclaimer: str(row.disclaimer),
		createdAt: str(row.created_at)
	};
}

function mapTemplate(value: unknown): CreateTemplate {
	const row = asJson(value);
	return {
		id: str(row.id),
		platform: str(row.platform) as CreatePlatform,
		name: str(row.name),
		body: str(row.body)
	};
}

function mapInspiration(value: unknown): Inspiration {
	const row = asJson(value);
	return {
		id: str(row.id),
		topic: str(row.topic),
		platform: str(row.platform) as CreatePlatform,
		hook: str(row.hook)
	};
}

function parseError(status: number, body: unknown): ApiError {
	const rec = asJson(body);
	const error = asJson(rec.error);
	const code = str(error.code) || (status === 401 ? 'unauthenticated' : 'unavailable');
	const message = str(error.message) || '请求失败';
	return new ApiError(code, message);
}

/**
 * Live `/v1` implementation of {@link QingxinApi}.
 *
 * Maps OpenAPI snake_case JSON to the existing camelCase types, turns
 * `{ error: { code, message } }` (and network failures) into {@link ApiError},
 * and refreshes the access token once on 401 via `POST /v1/auth/refresh`.
 */
export class HttpQingxinApi implements QingxinApi {
	readonly #baseUrl: string;
	readonly #fetch: typeof fetch;
	readonly #storage: StorageLike;
	readonly #policyVersion: string;
	#session: Session | null = null;

	constructor(options: HttpQingxinApiOptions) {
		this.#baseUrl = dropSlash(options.baseUrl);
		this.#fetch = options.fetch ?? fetch.bind(globalThis);
		this.#storage = options.storage ?? defaultStorage();
		this.#policyVersion = options.policyVersion ?? PRIVACY_POLICY_VERSION;
	}

	#readStored(): Session | null {
		try {
			const raw = this.#storage.getItem(SESSION_KEY);
			return raw ? (JSON.parse(raw) as Session) : null;
		} catch {
			return null;
		}
	}

	#persist(session: Session | null): void {
		this.#session = session;
		try {
			if (!session) this.#storage.removeItem(SESSION_KEY);
			else this.#storage.setItem(SESSION_KEY, JSON.stringify(session));
		} catch {
			/* private mode */
		}
	}

	#currentSession(): Session | null {
		this.#session ??= this.#readStored();
		return this.#session;
	}

	async #raw(
		method: string,
		path: string,
		options: { json?: unknown; auth?: boolean; retry?: boolean } = {}
	): Promise<Response> {
		const headers = new Headers();
		headers.set('Accept', 'application/json');
		if (options.json !== undefined) headers.set('Content-Type', 'application/json');
		const session = this.#currentSession();
		if (options.auth !== false && session?.token) {
			headers.set('Authorization', `Bearer ${session.token}`);
		}
		let response: Response;
		try {
			response = await this.#fetch(`${this.#baseUrl}${path}`, {
				method,
				headers,
				body: options.json === undefined ? undefined : JSON.stringify(options.json)
			});
		} catch {
			throw new ApiError('unavailable', '网络不可用');
		}
		if (
			response.status === 401 &&
			options.auth !== false &&
			options.retry !== false &&
			session?.refreshToken
		) {
			await this.#refresh();
			return this.#raw(method, path, { ...options, retry: false });
		}
		return response;
	}

	async #refresh(): Promise<void> {
		const session = this.#currentSession();
		if (!session?.refreshToken) throw new ApiError('unauthenticated', '请先登录');
		let response: Response;
		try {
			response = await this.#fetch(`${this.#baseUrl}/v1/auth/refresh`, {
				method: 'POST',
				headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
				body: JSON.stringify({ refresh_token: session.refreshToken })
			});
		} catch {
			throw new ApiError('unavailable', '网络不可用');
		}
		if (!response.ok) {
			this.#persist(null);
			throw await this.#error(response);
		}
		this.#persist(mapSession(asJson(await response.json())));
	}

	async #error(response: Response): Promise<ApiError> {
		try {
			return parseError(response.status, await response.json());
		} catch {
			return new ApiError('unavailable', '请求失败');
		}
	}

	async #json<T>(
		method: string,
		path: string,
		options: { json?: unknown; auth?: boolean } = {}
	): Promise<T> {
		const response = await this.#raw(method, path, options);
		if (response.status === 204) return undefined as T;
		if (!response.ok) throw await this.#error(response);
		if (response.status === 204 || response.headers.get('content-length') === '0') {
			return undefined as T;
		}
		const text = await response.text();
		if (!text) return undefined as T;
		return JSON.parse(text) as T;
	}

	async getSession(): Promise<Session | null> {
		if (this.#session) return this.#session;
		const stored = this.#readStored();
		if (!stored?.token) return null;
		this.#session = stored;
		try {
			const me = asJson(await this.#json('GET', '/v1/me'));
			const next: Session = {
				...stored,
				userId: str(me.id, stored.userId),
				displayName: str(me.display_name, stored.displayName),
				email: str(me.email, stored.email)
			};
			this.#persist(next);
			return next;
		} catch (error) {
			if (error instanceof ApiError && error.code === 'unauthenticated') {
				this.#persist(null);
				return null;
			}
			return stored;
		}
	}

	async login(email: string, password: string): Promise<Session> {
		const body = asJson(
			await this.#json('POST', '/v1/auth/login', {
				json: { email, password },
				auth: false
			})
		);
		const session = mapSession(body);
		this.#persist(session);
		return session;
	}

	async register(name: string, email: string, password: string): Promise<Session> {
		const body = asJson(
			await this.#json('POST', '/v1/auth/register', {
				json: {
					email,
					password,
					display_name: name,
					consent: { policy_version: this.#policyVersion }
				},
				auth: false
			})
		);
		const session = mapSession(body);
		this.#persist(session);
		return session;
	}

	async logout(): Promise<void> {
		const session = this.#currentSession();
		if (session?.refreshToken) {
			try {
				await this.#json('POST', '/v1/auth/logout', {
					json: { refresh_token: session.refreshToken },
					auth: false
				});
			} catch {
				/* still clear locally */
			}
		}
		this.#persist(null);
	}

	async listModules() {
		return MODULES;
	}

	async exportUserData(): Promise<ExportPayload> {
		const body = asJson(await this.#json('GET', '/v1/privacy/export'));
		const user = asJson(body.user);
		return {
			exportedAt: str(body.exported_at),
			data: {
				email: str(user.email),
				displayName: str(user.display_name),
				modules: MODULES.map((item) => item.name),
				moodLogs: itemsOf(body.mood_logs).length
					? itemsOf(body.mood_logs).map(mapMoodLog)
					: Array.isArray(body.mood_logs)
						? body.mood_logs.map(mapMoodLog)
						: [],
				meditationSessions: Array.isArray(body.meditation_sessions)
					? body.meditation_sessions.map(mapMeditation)
					: [],
				applications: Array.isArray(body.applications) ? body.applications.map(mapApplication) : [],
				resumes: Array.isArray(body.resumes) ? body.resumes.map(mapResume) : [],
				sideHustles: Array.isArray(body.side_hustles) ? body.side_hustles.map(mapHustle) : [],
				localReviews: Array.isArray(body.local_reviews) ? body.local_reviews.map(mapReview) : [],
				localServices: Array.isArray(body.local_services)
					? body.local_services.map(mapService)
					: [],
				localCorrections: Array.isArray(body.local_corrections)
					? body.local_corrections.map(mapCorrection)
					: [],
				creations: Array.isArray(body.creations) ? body.creations.map(mapCreation) : [],
				snippets: Array.isArray(body.snippets) ? body.snippets.map(mapSnippet) : [],
				aiTasks: Array.isArray(body.ai_tasks) ? body.ai_tasks.map(mapTask) : []
			}
		};
	}

	async deleteAccount(): Promise<void> {
		await this.#json('DELETE', '/v1/privacy/account');
		this.#persist(null);
	}

	async createMoodLog(input: CreateMoodLogInput): Promise<MoodLog> {
		return mapMoodLog(
			await this.#json('POST', '/v1/mood/logs', {
				json: compact({ id: input.id, emoji: input.emoji, tags: input.tags, note: input.note })
			})
		);
	}

	async listMoodLogs(filter?: { tag?: string }): Promise<MoodLog[]> {
		const path = `/v1/mood/logs${queryString({ tag: filter?.tag })}`;
		return itemsOf(await this.#json('GET', path)).map(mapMoodLog);
	}

	async getMoodTrends(period: 'week' | 'month', tag?: string) {
		const path = `/v1/mood/trends${queryString({ period, tag })}`;
		const body = asJson(await this.#json('GET', path));
		return {
			period: str(body.period, period),
			points: (Array.isArray(body.points) ? body.points : []).map((item) => {
				const row = asJson(item);
				return { date: str(row.date), averageScore: num(row.average_score), count: num(row.count) };
			})
		};
	}

	async createMoodInsight(input: {
		moodLogId?: string;
		emoji?: string;
		tags?: string[];
		note?: string;
	}): Promise<MoodInsight> {
		return mapInsight(
			await this.#json('POST', '/v1/mood/insights', {
				json: compact({
					mood_log_id: input.moodLogId,
					emoji: input.emoji,
					tags: input.tags,
					note: input.note
				})
			})
		);
	}

	async getMonthlyMoodSummary(month: string): Promise<MoodInsight> {
		return mapInsight(
			await this.#json('GET', `/v1/mood/summaries/monthly${queryString({ month })}`)
		);
	}

	async getMeditationCatalog(): Promise<MeditationCatalog> {
		const body = asJson(await this.#json('GET', '/v1/meditation/catalog'));
		return {
			sounds: (Array.isArray(body.sounds) ? body.sounds : []).map((item) => {
				const row = asJson(item);
				return { id: str(row.id), name: str(row.name) };
			}),
			stories: (Array.isArray(body.stories) ? body.stories : []).map((item) => {
				const row = asJson(item);
				return { id: str(row.id), title: str(row.title), body: str(row.body) };
			})
		};
	}

	async createMeditationSession(input: {
		id?: string;
		kind: MeditationKind;
		durationSec: number;
		payload?: Record<string, unknown>;
	}): Promise<MeditationSession> {
		return mapMeditation(
			await this.#json('POST', '/v1/meditation/sessions', {
				json: compact({
					id: input.id,
					kind: input.kind,
					duration_sec: input.durationSec,
					payload: input.payload
				})
			})
		);
	}

	async listMeditationSessions(): Promise<MeditationSession[]> {
		return itemsOf(await this.#json('GET', '/v1/meditation/sessions')).map(mapMeditation);
	}

	async createApplication(input: {
		id?: string;
		company: string;
		position: string;
		status?: Application['status'];
		interviewDate?: string;
		notes?: string;
	}): Promise<Application> {
		return mapApplication(
			await this.#json('POST', '/v1/hustle/applications', {
				json: compact({
					id: input.id,
					company: input.company,
					position: input.position,
					status: input.status,
					interview_date: input.interviewDate,
					notes: input.notes
				})
			})
		);
	}

	async listApplications(): Promise<Application[]> {
		return itemsOf(await this.#json('GET', '/v1/hustle/applications')).map(mapApplication);
	}

	async patchApplication(
		id: string,
		patch: { status?: Application['status']; interviewDate?: string; notes?: string }
	): Promise<Application> {
		return mapApplication(
			await this.#json('PATCH', `/v1/hustle/applications/${encodeURIComponent(id)}`, {
				json: compact({
					status: patch.status,
					interview_date: patch.interviewDate,
					notes: patch.notes
				})
			})
		);
	}

	async getHustleFunnel(): Promise<{ stages: FunnelStage[] }> {
		const body = asJson(await this.#json('GET', '/v1/hustle/funnel'));
		const stages = (Array.isArray(body.stages) ? body.stages : []).map((item) => {
			const row = asJson(item);
			const status = str(row.status);
			return {
				status: status === '面试' || status === 'Offer' ? status : '投递',
				count: num(row.count)
			} satisfies FunnelStage;
		});
		return { stages };
	}

	async createResume(input: {
		id?: string;
		title?: string;
		content: ResumeContent;
	}): Promise<ResumeVersion> {
		return mapResume(
			await this.#json('POST', '/v1/hustle/resumes', {
				json: compact({ id: input.id, title: input.title, content: input.content })
			})
		);
	}

	async listResumes(): Promise<ResumeVersion[]> {
		return itemsOf(await this.#json('GET', '/v1/hustle/resumes')).map(mapResume);
	}

	async patchResume(
		id: string,
		patch: { title?: string; content?: ResumeContent }
	): Promise<ResumeVersion> {
		return mapResume(
			await this.#json('PATCH', `/v1/hustle/resumes/${encodeURIComponent(id)}`, {
				json: compact({ title: patch.title, content: patch.content })
			})
		);
	}

	async optimizeResume(id: string): Promise<HustleAiText> {
		return mapAiText(
			await this.#json('POST', `/v1/hustle/resumes/${encodeURIComponent(id)}/optimize`)
		);
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
		return mapHustle(
			await this.#json('POST', '/v1/hustle/side-hustles', {
				json: compact({
					id: input.id,
					title: input.title,
					platform: input.platform,
					estimated_income: input.estimatedIncome,
					skills_required: input.skillsRequired,
					kind: input.kind,
					hours_per_week: input.hoursPerWeek
				})
			})
		);
	}

	async listSideHustles(kind?: SideHustle['kind']): Promise<SideHustle[]> {
		return itemsOf(await this.#json('GET', `/v1/hustle/side-hustles${queryString({ kind })}`)).map(
			mapHustle
		);
	}

	async suggestSideHustles(input: {
		skills: string[];
		hoursPerWeek: number;
	}): Promise<SideHustleSuggest> {
		const body = asJson(
			await this.#json('POST', '/v1/hustle/side-hustles/suggest', {
				json: { skills: input.skills, hours_per_week: input.hoursPerWeek }
			})
		);
		return {
			items: (Array.isArray(body.items) ? body.items : []).map(mapHustle),
			disclaimer: str(body.disclaimer),
			source: sourceOf(body.source)
		};
	}

	async listHustleQuestions(filter?: {
		role?: string;
		difficulty?: string;
	}): Promise<InterviewQuestion[]> {
		return itemsOf(
			await this.#json(
				'GET',
				`/v1/hustle/questions${queryString({ role: filter?.role, difficulty: filter?.difficulty })}`
			)
		).map(mapQuestion);
	}

	async mockInterview(input: { questionId?: string; question?: string }): Promise<HustleAiText> {
		return mapAiText(
			await this.#json('POST', '/v1/hustle/interviews/mock', {
				json: compact({ question_id: input.questionId, question: input.question })
			})
		);
	}

	async listLocalServices(filter?: {
		q?: string;
		category?: LocalCategory;
		tag?: ElderTag;
		sort?: LocalSort;
		lat?: number;
		lng?: number;
	}): Promise<LocalService[]> {
		return itemsOf(
			await this.#json(
				'GET',
				`/v1/local/services${queryString({
					q: filter?.q,
					category: filter?.category,
					tag: filter?.tag,
					sort: filter?.sort,
					lat: filter?.lat,
					lng: filter?.lng
				})}`
			)
		).map(mapService);
	}

	async getLocalService(id: string): Promise<LocalService> {
		return mapService(await this.#json('GET', `/v1/local/services/${encodeURIComponent(id)}`));
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
		return mapService(
			await this.#json('POST', '/v1/local/services', {
				json: compact({
					id: input.id,
					name: input.name,
					category: input.category,
					address: input.address,
					latitude: input.latitude,
					longitude: input.longitude,
					hours: input.hours,
					phone: input.phone,
					tags: input.tags
				})
			})
		);
	}

	async listLocalReviews(serviceId: string): Promise<LocalReview[]> {
		return itemsOf(
			await this.#json('GET', `/v1/local/services/${encodeURIComponent(serviceId)}/reviews`)
		).map(mapReview);
	}

	async createLocalReview(
		serviceId: string,
		input: { id?: string; content: string; rating?: number; images?: string[] }
	): Promise<LocalReview> {
		return mapReview(
			await this.#json('POST', `/v1/local/services/${encodeURIComponent(serviceId)}/reviews`, {
				json: compact({
					id: input.id,
					content: input.content,
					rating: input.rating,
					images: input.images
				})
			})
		);
	}

	async createLocalCorrection(
		serviceId: string,
		input: { id?: string; kind: CorrectionKind }
	): Promise<LocalCorrection> {
		return mapCorrection(
			await this.#json('POST', `/v1/local/services/${encodeURIComponent(serviceId)}/corrections`, {
				json: compact({ id: input.id, kind: input.kind })
			})
		);
	}

	async listCreations(): Promise<Creation[]> {
		return itemsOf(await this.#json('GET', '/v1/create/creations')).map(mapCreation);
	}

	async createCreation(input: {
		id?: string;
		platform: CreatePlatform;
		title?: string;
		promptParams?: Record<string, unknown>;
		generatedContent: string;
		finalContent?: string;
	}): Promise<Creation> {
		return mapCreation(
			await this.#json('POST', '/v1/create/creations', {
				json: compact({
					id: input.id,
					platform: input.platform,
					title: input.title,
					prompt_params: input.promptParams,
					generated_content: input.generatedContent,
					final_content: input.finalContent
				})
			})
		);
	}

	async getCreation(id: string): Promise<Creation> {
		return mapCreation(await this.#json('GET', `/v1/create/creations/${encodeURIComponent(id)}`));
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
		return mapCreation(
			await this.#json('PATCH', `/v1/create/creations/${encodeURIComponent(id)}`, {
				json: compact({
					title: patch.title,
					generated_content: patch.generatedContent,
					final_content: patch.finalContent,
					prompt_params: patch.promptParams
				})
			})
		);
	}

	async listCreateTemplates(platform?: CreatePlatform): Promise<CreateTemplate[]> {
		return itemsOf(await this.#json('GET', `/v1/create/templates${queryString({ platform })}`)).map(
			mapTemplate
		);
	}

	async listCreateInspiration(): Promise<Inspiration[]> {
		return itemsOf(await this.#json('GET', '/v1/create/inspiration')).map(mapInspiration);
	}

	async generateCreateCopy(input: {
		platform: CreatePlatform;
		topic: string;
		keywords?: string[];
		tone?: CreateTone;
		length?: CreateLength;
		templateId?: string;
	}): Promise<CreateAiText> {
		const body = asJson(
			await this.#json('POST', '/v1/create/generate', {
				json: compact({
					platform: input.platform,
					topic: input.topic,
					keywords: input.keywords,
					tone: input.tone,
					length: input.length,
					template_id: input.templateId
				})
			})
		);
		return {
			text: str(body.text),
			disclaimer: str(body.disclaimer),
			source: sourceOf(body.source)
		};
	}

	async generateCreateTitles(input: {
		topic: string;
		platform?: CreatePlatform;
	}): Promise<CreateTitles> {
		const body = asJson(
			await this.#json('POST', '/v1/create/titles', {
				json: compact({ topic: input.topic, platform: input.platform })
			})
		);
		return {
			titles: strList(body.titles),
			disclaimer: str(body.disclaimer),
			source: sourceOf(body.source)
		};
	}

	async polishCreateCopy(input: { text: string; tone: CreateTone }): Promise<CreateAiText> {
		const body = asJson(
			await this.#json('POST', '/v1/create/polish', {
				json: { text: input.text, tone: input.tone }
			})
		);
		return {
			text: str(body.text),
			disclaimer: str(body.disclaimer),
			source: sourceOf(body.source)
		};
	}

	async generateCreateOutline(input: { topic: string }): Promise<CreateOutlineResult> {
		const body = asJson(
			await this.#json('POST', '/v1/create/outline', { json: { topic: input.topic } })
		);
		const slides = (Array.isArray(body.slides) ? body.slides : []).map((item) => {
			const row = asJson(item);
			return { heading: str(row.heading), bullets: strList(row.bullets) };
		});
		return {
			title: str(body.title),
			slides,
			markdown: str(body.markdown),
			disclaimer: str(body.disclaimer),
			source: sourceOf(body.source)
		};
	}

	async listCreateSnippets(): Promise<CreateSnippet[]> {
		return itemsOf(await this.#json('GET', '/v1/create/snippets')).map(mapSnippet);
	}

	async createSnippet(input: {
		id?: string;
		content: string;
		kind?: SnippetKind;
		tags?: string[];
	}): Promise<CreateSnippet> {
		return mapSnippet(
			await this.#json('POST', '/v1/create/snippets', {
				json: compact({
					id: input.id,
					content: input.content,
					kind: input.kind,
					tags: input.tags
				})
			})
		);
	}

	async useSnippet(id: string): Promise<CreateSnippet> {
		return mapSnippet(
			await this.#json('POST', `/v1/create/snippets/${encodeURIComponent(id)}/use`)
		);
	}

	async listTools(): Promise<ToolCatalog> {
		const body = asJson(await this.#json('GET', '/v1/tools'));
		return mergeCatalog(strList(body.favourites), strList(body.recent));
	}

	async setToolFavourite(toolId: ToolId, favourite: boolean) {
		const body = asJson(
			await this.#json('PUT', `/v1/tools/${encodeURIComponent(toolId)}/favourite`, {
				json: { favourite }
			})
		);
		return { toolId: str(body.tool_id, toolId) as ToolId, favourite: Boolean(body.favourite) };
	}

	async listAiTasks(toolId?: ToolId): Promise<AiTask[]> {
		return itemsOf(
			await this.#json('GET', `/v1/tools/tasks${queryString({ tool_id: toolId })}`)
		).map(mapTask);
	}

	async getAiTask(id: string): Promise<AiTask> {
		return mapTask(await this.#json('GET', `/v1/tools/tasks/${encodeURIComponent(id)}`));
	}

	async *runTool(input: ToolRunInput): AsyncIterable<ToolStreamEvent> {
		const response = await this.#raw('POST', `/v1/tools/${encodeURIComponent(input.toolId)}/run`, {
			json: compact({
				input_kind: input.inputKind,
				text: input.text,
				url: input.url,
				filename: input.filename,
				resume: input.resume,
				jd: input.jd,
				filenames: input.filenames,
				tone: input.tone,
				step: input.step,
				topics: input.topics
			})
		});
		if (!response.ok) throw await this.#error(response);
		const reader = response.body?.getReader();
		if (!reader) return;
		const decoder = new TextDecoder();
		let buffer = '';
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			const blocks = buffer.split('\n\n');
			buffer = blocks.pop() ?? '';
			for (const block of blocks) {
				yield* parseSseBlock(block);
			}
		}
		if (buffer.trim()) yield* parseSseBlock(buffer);
	}

	#modules() {
		return createHttpModules((method, path, options) => this.#json(method, path, options));
	}

	async listFinanceCategories() {
		return this.#modules().listFinanceCategories();
	}
	async createFinanceTransaction(input: FinanceTxInput) {
		return this.#modules().createFinanceTransaction(input);
	}
	async listFinanceTransactions(month?: string) {
		return this.#modules().listFinanceTransactions(month);
	}
	async getFinanceSummary(month: string) {
		return this.#modules().getFinanceSummary(month);
	}
	async getFinanceReport(month: string) {
		return this.#modules().getFinanceReport(month);
	}
	async listFinanceBudgets() {
		return this.#modules().listFinanceBudgets();
	}
	async putFinanceBudgets(items: FinanceBudgetInput[]) {
		return this.#modules().putFinanceBudgets(items);
	}
	async listFinanceSubscriptions() {
		return this.#modules().listFinanceSubscriptions();
	}
	async listUpcomingSubscriptions() {
		return this.#modules().listUpcomingSubscriptions();
	}
	async createFinanceSubscription(input: FinanceSubInput) {
		return this.#modules().createFinanceSubscription(input);
	}
	async deleteFinanceSubscription(id: string) {
		return this.#modules().deleteFinanceSubscription(id);
	}
	async listFinanceChallenges() {
		return this.#modules().listFinanceChallenges();
	}
	async createFinanceChallenge(input: FinanceChallengeInput) {
		return this.#modules().createFinanceChallenge(input);
	}
	async checkinFinanceChallenge(id: string, day: string) {
		return this.#modules().checkinFinanceChallenge(id, day);
	}
	async deleteFinanceChallenge(id: string) {
		return this.#modules().deleteFinanceChallenge(id);
	}
	async createJob(input: { runAt: string; title: string; body: string }) {
		return this.#modules().createJob(input);
	}
	async getElderToday(elderId?: string) {
		return this.#modules().getElderToday(elderId);
	}
	async listElderReminders(elderId?: string) {
		return this.#modules().listElderReminders(elderId);
	}
	async createElderReminder(input: ElderReminderInput, elderId?: string) {
		return this.#modules().createElderReminder(input, elderId);
	}
	async ackElderReminder(id: string, occurrenceAt: string, elderId?: string) {
		return this.#modules().ackElderReminder(id, occurrenceAt, elderId);
	}
	async listElderContacts(elderId?: string) {
		return this.#modules().listElderContacts(elderId);
	}
	async getElderProfile(elderId?: string) {
		return this.#modules().getElderProfile(elderId);
	}
	async patchElderProfile(
		input: { activityLogOptIn?: boolean; timezone?: string },
		elderId?: string
	) {
		return this.#modules().patchElderProfile(input, elderId);
	}
	async getWellnessToday() {
		return this.#modules().getWellnessToday();
	}
	async addWellnessWater(ml: number, loggedOn: string) {
		return this.#modules().addWellnessWater(ml, loggedOn);
	}
	async listWellnessWater() {
		return this.#modules().listWellnessWater();
	}
	async addWellnessSleep(input: {
		sleepAt: string;
		wakeAt: string;
		quality: number;
		note?: string | null;
	}) {
		return this.#modules().addWellnessSleep(input);
	}
	async listWellnessSleep() {
		return this.#modules().listWellnessSleep();
	}
	async putWellnessConsent(cycleConsent: boolean) {
		return this.#modules().putWellnessConsent(cycleConsent);
	}
	async addWellnessCycle(input: {
		startDate: string;
		endDate?: string | null;
		flowLevel?: CycleLog['flowLevel'];
		symptoms?: string | null;
	}) {
		return this.#modules().addWellnessCycle(input);
	}
	async listWellnessCycles() {
		return this.#modules().listWellnessCycles();
	}
	async addWellnessReport(input: {
		title: string;
		reportDate: string;
		metrics: ReportLog['metrics'];
	}) {
		return this.#modules().addWellnessReport(input);
	}
	async listWellnessReports() {
		return this.#modules().listWellnessReports();
	}
	async createWellnessPlan(kind: PlanLog['kind']) {
		return this.#modules().createWellnessPlan(kind);
	}
	async listWellnessPlans() {
		return this.#modules().listWellnessPlans();
	}
	async checkinWellnessPlan(id: string, day: string) {
		return this.#modules().checkinWellnessPlan(id, day);
	}
	async listWellnessReminders() {
		return this.#modules().listWellnessReminders();
	}
	async createWellnessReminder(input: {
		kind: ReminderLog['kind'];
		time: string;
		daysOfWeek: number[];
	}) {
		return this.#modules().createWellnessReminder(input);
	}
}

function* parseSseBlock(block: string): Generator<ToolStreamEvent> {
	const lines = block.split('\n');
	let event = '';
	const dataLines: string[] = [];
	for (const line of lines) {
		if (line.startsWith('event:')) event = line.slice(6).trim();
		else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
	}
	const data = dataLines.join('\n');
	if (!data || data === '[DONE]') return;
	if (event === 'result') {
		try {
			yield { type: 'result', task: mapTask(JSON.parse(data)) };
		} catch {
			/* ignore malformed result */
		}
		return;
	}
	try {
		const parsed = JSON.parse(data) as Json;
		const text = str(asJson(asJson((parsed.choices as unknown[] | undefined)?.[0]).delta).content);
		if (text) yield { type: 'delta', text };
	} catch {
		/* ignore keep-alives */
	}
}

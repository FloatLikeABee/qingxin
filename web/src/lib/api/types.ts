import type { ModuleInfo } from '../modules';
import type { MoodLog } from '../mood/trends';
import type { InterviewQuestion, SideHustle } from '../hustle/catalog';
import type { Application, FunnelStage } from '../hustle/funnel';
import type { ResumeContent } from '../hustle/resume';
import type {
	CreateLength,
	CreateOutline,
	CreatePlatform,
	CreateTemplate,
	CreateTone,
	Inspiration,
	SnippetKind
} from '../create/catalog';
import type { InputKind, MeetingStep, PolishTone, ToolId, ToolItem } from '../tools/catalog';
import type {
	CorrectionKind,
	ElderTag,
	LocalCategory,
	LocalCorrection,
	LocalReview,
	LocalService
} from '../local/catalog';
import type { LocalSort } from '../local/geo';

/** Access session persisted as `qingxin.session`. `refreshToken` is set by `HttpQingxinApi`. */
export interface Session {
	userId: string;
	displayName: string;
	email: string;
	token: string;
	refreshToken?: string;
}

export interface ExportPayload {
	exportedAt: string;
	data: {
		email: string;
		displayName: string;
		modules: string[];
		moodLogs?: MoodLog[];
		meditationSessions?: MeditationSession[];
		applications?: Application[];
		resumes?: ResumeVersion[];
		sideHustles?: SideHustle[];
		localReviews?: LocalReview[];
		localServices?: LocalService[];
		localCorrections?: LocalCorrection[];
		creations?: Creation[];
		snippets?: CreateSnippet[];
		aiTasks?: AiTask[];
		aiTemplates?: AiTemplate[];
	};
}

export interface ResumeVersion {
	id: string;
	version: number;
	title?: string | null;
	content: ResumeContent;
	pdfUrl?: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface HustleAiText {
	text: string;
	disclaimer: string;
	source: 'mock' | 'gateway';
	question?: string;
}

export interface SideHustleSuggest {
	items: SideHustle[];
	disclaimer: string;
	source: 'mock' | 'gateway';
}

export interface CreationVersion {
	at: string;
	kind: string;
	content: string;
}

export interface Creation {
	id: string;
	platform: CreatePlatform;
	title?: string | null;
	promptParams?: Record<string, unknown>;
	generatedContent: string;
	finalContent: string;
	versions: CreationVersion[];
	createdAt: string;
	updatedAt: string;
}

export interface CreateSnippet {
	id: string;
	content: string;
	kind: SnippetKind;
	tags: string[];
	usageCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface CreateAiText {
	text: string;
	disclaimer: string;
	source: 'mock' | 'gateway';
}

export interface CreateTitles {
	titles: string[];
	disclaimer: string;
	source: 'mock' | 'gateway';
}

export interface CreateOutlineResult extends CreateOutline {
	disclaimer: string;
	source: 'mock' | 'gateway';
	markdown: string;
}

export interface AiTask {
	id: string;
	toolId: ToolId;
	inputKind: string;
	inputText: string;
	inputMeta: Record<string, unknown>;
	outputText: string;
	outputJson: Record<string, unknown>;
	source: 'mock' | 'gateway';
	disclaimer: string;
	createdAt: string;
}

export interface AiTemplate {
	id: string;
	toolId: ToolId;
	title: string;
	body: string;
	favourite: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface ToolCatalog {
	items: ToolItem[];
	recent: ToolId[];
	favourites: ToolId[];
}

export interface ToolRunInput {
	toolId: ToolId;
	inputKind?: InputKind;
	text?: string;
	url?: string;
	filename?: string;
	resume?: string;
	jd?: string;
	filenames?: string[];
	tone?: PolishTone;
	step?: MeetingStep;
	topics?: string[];
}

export type ToolStreamEvent = { type: 'delta'; text: string } | { type: 'result'; task: AiTask };

export interface MoodInsight {
	text: string;
	disclaimer: string;
	source: 'mock' | 'gateway';
	month?: string;
}

export interface MeditationSound {
	id: string;
	name: string;
}

export interface MeditationStory {
	id: string;
	title: string;
	body: string;
}

export interface MeditationCatalog {
	sounds: MeditationSound[];
	stories: MeditationStory[];
}

export type MeditationKind = 'breathe' | 'noise' | 'story' | 'timer';

export interface MeditationSession {
	id: string;
	kind: MeditationKind;
	durationSec: number;
	payload?: Record<string, unknown>;
	startedAt: string;
	endedAt?: string | null;
}

export interface MoodTrendPoint {
	date: string;
	averageScore: number;
	count: number;
}

export interface CreateMoodLogInput {
	id?: string;
	emoji: string;
	tags: string[];
	note?: string;
}

/**
 * Typed Qingxin client. Screens and stores depend on this interface, not `fetch`.
 *
 * `getApi()` in `./client.ts` returns `HttpQingxinApi` when `PUBLIC_API_URL` is set,
 * otherwise `MockQingxinApi`. Add module methods here so both implementations stay in sync.
 */
export interface QingxinApi {
	getSession(): Promise<Session | null>;
	login(email: string, password: string): Promise<Session>;
	register(name: string, email: string, password: string): Promise<Session>;
	logout(): Promise<void>;
	listModules(): Promise<ModuleInfo[]>;
	exportUserData(): Promise<ExportPayload>;
	deleteAccount(): Promise<void>;
	createMoodLog(input: CreateMoodLogInput): Promise<MoodLog>;
	listMoodLogs(filter?: { tag?: string }): Promise<MoodLog[]>;
	getMoodTrends(
		period: 'week' | 'month',
		tag?: string
	): Promise<{ period: string; points: MoodTrendPoint[] }>;
	createMoodInsight(input: {
		moodLogId?: string;
		emoji?: string;
		tags?: string[];
		note?: string;
	}): Promise<MoodInsight>;
	getMonthlyMoodSummary(month: string): Promise<MoodInsight>;
	getMeditationCatalog(): Promise<MeditationCatalog>;
	createMeditationSession(input: {
		id?: string;
		kind: MeditationKind;
		durationSec: number;
		payload?: Record<string, unknown>;
	}): Promise<MeditationSession>;
	listMeditationSessions(): Promise<MeditationSession[]>;
	createApplication(input: {
		id?: string;
		company: string;
		position: string;
		status?: Application['status'];
		interviewDate?: string;
		notes?: string;
	}): Promise<Application>;
	listApplications(): Promise<Application[]>;
	patchApplication(
		id: string,
		patch: { status?: Application['status']; interviewDate?: string; notes?: string }
	): Promise<Application>;
	getHustleFunnel(): Promise<{ stages: FunnelStage[] }>;
	createResume(input: {
		id?: string;
		title?: string;
		content: ResumeContent;
	}): Promise<ResumeVersion>;
	listResumes(): Promise<ResumeVersion[]>;
	patchResume(
		id: string,
		patch: { title?: string; content?: ResumeContent }
	): Promise<ResumeVersion>;
	optimizeResume(id: string): Promise<HustleAiText>;
	createSideHustle(input: {
		id?: string;
		title: string;
		platform: string;
		estimatedIncome: number;
		skillsRequired: string[];
		kind: SideHustle['kind'];
		hoursPerWeek?: number;
	}): Promise<SideHustle>;
	listSideHustles(kind?: SideHustle['kind']): Promise<SideHustle[]>;
	suggestSideHustles(input: { skills: string[]; hoursPerWeek: number }): Promise<SideHustleSuggest>;
	listHustleQuestions(filter?: {
		role?: string;
		difficulty?: string;
	}): Promise<InterviewQuestion[]>;
	mockInterview(input: { questionId?: string; question?: string }): Promise<HustleAiText>;
	listLocalServices(filter?: {
		q?: string;
		category?: LocalCategory;
		tag?: ElderTag;
		sort?: LocalSort;
		lat?: number;
		lng?: number;
	}): Promise<LocalService[]>;
	getLocalService(id: string): Promise<LocalService>;
	createLocalService(input: {
		id?: string;
		name: string;
		category: LocalCategory;
		address: string;
		latitude: number;
		longitude: number;
		hours?: string;
		phone?: string;
		tags?: ElderTag[];
	}): Promise<LocalService>;
	listLocalReviews(serviceId: string): Promise<LocalReview[]>;
	createLocalReview(
		serviceId: string,
		input: { id?: string; content: string; rating?: number; images?: string[] }
	): Promise<LocalReview>;
	createLocalCorrection(
		serviceId: string,
		input: { id?: string; kind: CorrectionKind }
	): Promise<LocalCorrection>;
	listCreations(): Promise<Creation[]>;
	createCreation(input: {
		id?: string;
		platform: CreatePlatform;
		title?: string;
		promptParams?: Record<string, unknown>;
		generatedContent: string;
		finalContent?: string;
	}): Promise<Creation>;
	getCreation(id: string): Promise<Creation>;
	patchCreation(
		id: string,
		patch: {
			title?: string;
			generatedContent?: string;
			finalContent?: string;
			promptParams?: Record<string, unknown>;
		}
	): Promise<Creation>;
	listCreateTemplates(platform?: CreatePlatform): Promise<CreateTemplate[]>;
	listCreateInspiration(): Promise<Inspiration[]>;
	generateCreateCopy(input: {
		platform: CreatePlatform;
		topic: string;
		keywords?: string[];
		tone?: CreateTone;
		length?: CreateLength;
		templateId?: string;
	}): Promise<CreateAiText>;
	generateCreateTitles(input: { topic: string; platform?: CreatePlatform }): Promise<CreateTitles>;
	polishCreateCopy(input: { text: string; tone: CreateTone }): Promise<CreateAiText>;
	generateCreateOutline(input: { topic: string }): Promise<CreateOutlineResult>;
	listCreateSnippets(): Promise<CreateSnippet[]>;
	createSnippet(input: {
		id?: string;
		content: string;
		kind?: SnippetKind;
		tags?: string[];
	}): Promise<CreateSnippet>;
	useSnippet(id: string): Promise<CreateSnippet>;
	listTools(): Promise<ToolCatalog>;
	setToolFavourite(
		toolId: ToolId,
		favourite: boolean
	): Promise<{ toolId: ToolId; favourite: boolean }>;
	listAiTasks(toolId?: ToolId): Promise<AiTask[]>;
	getAiTask(id: string): Promise<AiTask>;
	runTool(input: ToolRunInput): AsyncIterable<ToolStreamEvent>;
}

export class ApiError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = 'ApiError';
		this.code = code;
	}
}

import type { ModuleInfo } from '../modules';
import type { MoodLog } from '../mood/trends';
import type { InterviewQuestion, SideHustle } from '../hustle/catalog';
import type { Application, FunnelStage } from '../hustle/funnel';
import type { ResumeContent } from '../hustle/resume';
import type {
	CorrectionKind,
	ElderTag,
	LocalCategory,
	LocalCorrection,
	LocalReview,
	LocalService
} from '../local/catalog';
import type { LocalSort } from '../local/geo';

export interface Session {
	userId: string;
	displayName: string;
	email: string;
	token: string;
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
}

export class ApiError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = 'ApiError';
		this.code = code;
	}
}

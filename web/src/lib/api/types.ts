import type { ModuleInfo } from '../modules';
import type { MoodLog } from '../mood/trends';

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
	};
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
	getMoodTrends(period: 'week' | 'month', tag?: string): Promise<{ period: string; points: MoodTrendPoint[] }>;
	createMoodInsight(input: { moodLogId?: string; emoji?: string; tags?: string[]; note?: string }): Promise<MoodInsight>;
	getMonthlyMoodSummary(month: string): Promise<MoodInsight>;
	getMeditationCatalog(): Promise<MeditationCatalog>;
	createMeditationSession(input: {
		id?: string;
		kind: MeditationKind;
		durationSec: number;
		payload?: Record<string, unknown>;
	}): Promise<MeditationSession>;
	listMeditationSessions(): Promise<MeditationSession[]>;
}

export class ApiError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = 'ApiError';
		this.code = code;
	}
}

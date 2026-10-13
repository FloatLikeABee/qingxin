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
import type { ElderContact, ElderReminder } from '../elder/demo';
import type { ElderReminderInput, ElderToday } from '../elder/payload';
import type {
	FinanceBudgetInput,
	FinanceChallengeInput,
	FinanceReport,
	FinanceSubInput,
	FinanceTxInput
} from '../finance/payload';
import type {
	FinanceBudget,
	FinanceCategory,
	FinanceChallenge,
	FinanceSubscription,
	FinanceSummary,
	FinanceTransaction
} from '../finance/types';
import type {
	CycleLog,
	PlanLog,
	ReminderLog,
	ReportLog,
	SleepLog,
	TodaySnapshot,
	WaterLog
} from '../wellness/types';
import type {
	CareType,
	CreatePetInput,
	Pet,
	PetLog,
	PetRecord,
	PetWeight,
	RecordType,
	TodaySummary
} from '../pets/types';
import type {
	Grade,
	StudyCard,
	StudyChallenge,
	StudyNote,
	StudySkill,
	StudySkillTemplate,
	TargetDays
} from '../study/types';

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
	pdfBase64?: string;
	resume?: string;
	jd?: string;
	filenames?: string[];
	tone?: PolishTone;
	step?: MeetingStep;
	topics?: string[];
	signal?: AbortSignal;
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
	listFinanceCategories(): Promise<FinanceCategory[]>;
	createFinanceTransaction(input: FinanceTxInput): Promise<FinanceTransaction>;
	listFinanceTransactions(month?: string): Promise<FinanceTransaction[]>;
	getFinanceSummary(month: string): Promise<FinanceSummary>;
	getFinanceReport(month: string): Promise<FinanceReport>;
	listFinanceBudgets(): Promise<FinanceBudget[]>;
	putFinanceBudgets(items: FinanceBudgetInput[]): Promise<FinanceBudget[]>;
	listFinanceSubscriptions(): Promise<FinanceSubscription[]>;
	listUpcomingSubscriptions(): Promise<FinanceSubscription[]>;
	createFinanceSubscription(input: FinanceSubInput): Promise<FinanceSubscription>;
	deleteFinanceSubscription(id: string): Promise<void>;
	listFinanceChallenges(): Promise<FinanceChallenge[]>;
	createFinanceChallenge(input: FinanceChallengeInput): Promise<FinanceChallenge>;
	checkinFinanceChallenge(id: string, day: string): Promise<FinanceChallenge>;
	deleteFinanceChallenge(id: string): Promise<void>;
	createJob(input: { runAt: string; title: string; body: string }): Promise<{
		id: string;
		kind: string;
		runAt: string;
		status: string;
		payload: Record<string, unknown>;
	}>;
	getElderToday(elderId?: string): Promise<ElderToday>;
	listElderReminders(elderId?: string): Promise<ElderReminder[]>;
	createElderReminder(input: ElderReminderInput, elderId?: string): Promise<ElderReminder>;
	ackElderReminder(id: string, occurrenceAt: string, elderId?: string): Promise<void>;
	listElderContacts(elderId?: string): Promise<ElderContact[]>;
	getElderProfile(elderId?: string): Promise<{
		userId: string;
		activityLogOptIn: boolean;
		timezone: string;
	}>;
	patchElderProfile(
		input: { activityLogOptIn?: boolean; timezone?: string },
		elderId?: string
	): Promise<{ userId: string; activityLogOptIn: boolean; timezone: string }>;
	getWellnessToday(): Promise<TodaySnapshot>;
	addWellnessWater(ml: number, loggedOn: string): Promise<WaterLog>;
	listWellnessWater(): Promise<WaterLog[]>;
	addWellnessSleep(input: {
		sleepAt: string;
		wakeAt: string;
		quality: number;
		note?: string | null;
	}): Promise<SleepLog>;
	listWellnessSleep(): Promise<SleepLog[]>;
	putWellnessConsent(cycleConsent: boolean): Promise<{ cycleConsent: boolean }>;
	addWellnessCycle(input: {
		startDate: string;
		endDate?: string | null;
		flowLevel?: CycleLog['flowLevel'];
		symptoms?: string | null;
	}): Promise<CycleLog>;
	listWellnessCycles(): Promise<CycleLog[]>;
	addWellnessReport(input: {
		title: string;
		reportDate: string;
		metrics: ReportLog['metrics'];
	}): Promise<ReportLog>;
	listWellnessReports(): Promise<ReportLog[]>;
	createWellnessPlan(kind: PlanLog['kind']): Promise<PlanLog>;
	listWellnessPlans(): Promise<PlanLog[]>;
	checkinWellnessPlan(id: string, day: string): Promise<PlanLog>;
	listWellnessReminders(): Promise<ReminderLog[]>;
	createWellnessReminder(input: {
		kind: ReminderLog['kind'];
		time: string;
		daysOfWeek: number[];
	}): Promise<ReminderLog>;
	listPets(): Promise<Pet[]>;
	createPet(input: CreatePetInput): Promise<Pet>;
	getPet(id: string): Promise<Pet>;
	getPetsToday(): Promise<TodaySummary>;
	listPetRecords(petId: string): Promise<PetRecord[]>;
	createPetRecord(
		petId: string,
		input: { type: RecordType; date: string; nextDueDate?: string | null; note?: string | null }
	): Promise<PetRecord>;
	listPetWeights(petId: string): Promise<PetWeight[]>;
	createPetWeight(
		petId: string,
		input: { measuredOn: string; weightG: number }
	): Promise<PetWeight>;
	listPetLogs(petId: string): Promise<PetLog[]>;
	createPetLog(petId: string, input: { type: CareType; value?: string | null }): Promise<PetLog>;
	getStudyToday(): Promise<{
		disclaimer: string;
		date: string;
		challenges: StudyChallenge[];
		dueFlashcards: number;
	}>;
	listStudyChallenges(): Promise<StudyChallenge[]>;
	createStudyChallenge(input: {
		name: string;
		targetDays: TargetDays;
		timezone?: string;
	}): Promise<StudyChallenge>;
	checkinStudyChallenge(
		id: string,
		day?: string
	): Promise<{ id: string; challengeId: string; day: string; createdAt: string }>;
	listStudyFlashcards(): Promise<StudyCard[]>;
	listDueStudyFlashcards(): Promise<StudyCard[]>;
	createStudyFlashcard(input: {
		front: string;
		back: string;
		category?: string | null;
	}): Promise<StudyCard>;
	reviewStudyFlashcard(id: string, grade: Grade): Promise<StudyCard>;
	listStudyNotes(q?: string): Promise<StudyNote[]>;
	createStudyNote(input: {
		title: string;
		contentMd?: string;
		tags?: string[];
	}): Promise<StudyNote>;
	listStudySkills(): Promise<StudySkill[]>;
	createStudySkill(input: { title: string; parentId?: string | null }): Promise<StudySkill>;
	patchStudySkill(
		id: string,
		patch: { title?: string; parentId?: string | null; unlocked?: boolean; sortOrder?: number }
	): Promise<StudySkill>;
	listStudySkillTemplates(): Promise<StudySkillTemplate[]>;
	copyStudySkillTemplate(templateId: string): Promise<StudySkill[]>;
}

export class ApiError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = 'ApiError';
		this.code = code;
	}
}

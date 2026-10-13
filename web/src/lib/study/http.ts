import { TARGET_DAYS, type TargetDays, DISCLAIMER } from './disclaimer';
import type { Grade } from './review';
import type { StudyCard, StudyChallenge, StudyNote, StudySkill, StudySkillTemplate } from './types';

type Json = Record<string, unknown>;

function asJson(value: unknown): Json {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};
}

function str(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown): boolean {
	return value === true;
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

export function omitBlank(record: Json): Json {
	const next: Json = {};
	for (const [key, value] of Object.entries(record)) {
		if (value === undefined || value === null || value === '') continue;
		next[key] = value;
	}
	return next;
}

function asTargetDays(value: unknown): TargetDays {
	return value === 7 || value === 14 || value === 21 ? value : 7;
}

export function studyChallengeWriteBody(input: {
	name: string;
	targetDays: number;
	timezone?: string;
	startDate?: string;
}): Json {
	if (!TARGET_DAYS.includes(input.targetDays as TargetDays)) {
		throw new Error('target_days must be 7, 14 or 21');
	}
	return omitBlank({
		name: input.name.trim(),
		target_days: input.targetDays,
		timezone: input.timezone,
		start_date: input.startDate
	});
}

export function studyCheckinWriteBody(input: { day?: string } = {}): Json {
	return omitBlank({ day: input.day });
}

export function studyFlashcardWriteBody(input: {
	front: string;
	back: string;
	category?: string | null;
}): Json {
	return omitBlank({
		front: input.front,
		back: input.back,
		category: input.category?.trim() || undefined
	});
}

export function studyReviewWriteBody(input: { grade: Grade }): Json {
	return { grade: input.grade };
}

export function studyNoteWriteBody(input: {
	title: string;
	contentMd?: string;
	tags?: string[];
}): Json {
	return omitBlank({
		title: input.title.trim(),
		content_md: input.contentMd || undefined,
		tags: input.tags
	});
}

export function studySkillWriteBody(input: {
	title: string;
	parentId?: string | null;
	unlocked?: boolean;
	sortOrder?: number;
}): Json {
	return omitBlank({
		title: input.title.trim(),
		parent_id: input.parentId || undefined,
		unlocked: input.unlocked,
		sort_order: input.sortOrder
	});
}

export function studySkillPatchBody(input: {
	title?: string;
	parentId?: string | null;
	unlocked?: boolean;
	sortOrder?: number;
}): Json {
	const next = omitBlank({
		title: input.title,
		unlocked: input.unlocked,
		sort_order: input.sortOrder
	});
	if (input.parentId === null) next.parent_id = null;
	else if (input.parentId) next.parent_id = input.parentId;
	return next;
}

export function studyFromTemplateBody(input: { templateId: string }): Json {
	return { template_id: input.templateId };
}

function mapCheckinDays(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => (typeof item === 'string' ? item : str(asJson(item).day)))
		.filter(Boolean);
}

export function mapStudyChallenge(value: unknown): StudyChallenge {
	const row = asJson(value);
	const checkins = mapCheckinDays(row.checkins);
	return {
		id: str(row.id),
		name: str(row.name),
		targetDays: asTargetDays(row.target_days),
		startDate: str(row.start_date),
		timezone: str(row.timezone, 'Asia/Shanghai'),
		checkins,
		currentStreak: num(row.current_streak),
		progressDays: num(row.progress_days, checkins.length),
		checkedInToday: bool(row.checked_in_today)
	};
}

export function mapStudyChallengeList(value: unknown): StudyChallenge[] {
	return itemsOf(value).map(mapStudyChallenge);
}

export function mapStudyCheckin(value: unknown): {
	id: string;
	challengeId: string;
	day: string;
	createdAt: string;
} {
	const row = asJson(value);
	return {
		id: str(row.id),
		challengeId: str(row.challenge_id),
		day: str(row.day),
		createdAt: str(row.created_at)
	};
}

export function mapStudyCard(value: unknown): StudyCard {
	const row = asJson(value);
	return {
		id: str(row.id),
		front: str(row.front),
		back: str(row.back),
		category: row.category == null || row.category === '' ? null : str(row.category),
		ease: num(row.ease, 2.5),
		intervalDays: num(row.interval_days),
		nextReviewDate: str(row.next_review_date)
	};
}

export function mapStudyCardList(value: unknown): StudyCard[] {
	return itemsOf(value).map(mapStudyCard);
}

export function mapStudyNote(value: unknown): StudyNote {
	const row = asJson(value);
	return {
		id: str(row.id),
		title: str(row.title),
		contentMd: str(row.content_md),
		tags: strList(row.tags),
		updatedAt: str(row.updated_at)
	};
}

export function mapStudyNoteList(value: unknown): StudyNote[] {
	return itemsOf(value).map(mapStudyNote);
}

export function mapStudySkill(value: unknown): StudySkill {
	const row = asJson(value);
	return {
		id: str(row.id),
		parentId: row.parent_id == null || row.parent_id === '' ? null : str(row.parent_id),
		title: str(row.title),
		unlocked: row.unlocked === true || row.unlocked === 1,
		sortOrder: num(row.sort_order)
	};
}

export function mapStudySkillList(value: unknown): StudySkill[] {
	return itemsOf(value).map(mapStudySkill);
}

export function mapStudyTemplate(value: unknown): StudySkillTemplate {
	const row = asJson(value);
	return {
		id: str(row.id),
		title: str(row.title),
		nodes: Array.isArray(row.nodes)
			? row.nodes.map((node) => {
					const item = asJson(node);
					return {
						key: str(item.key),
						title: str(item.title),
						parent: item.parent == null ? null : str(item.parent),
						unlocked: bool(item.unlocked)
					};
				})
			: []
	};
}

export function mapStudyTemplateList(value: unknown): StudySkillTemplate[] {
	return itemsOf(value).map(mapStudyTemplate);
}

export function mapStudyToday(value: unknown): {
	disclaimer: string;
	date: string;
	challenges: StudyChallenge[];
	dueFlashcards: number;
} {
	const row = asJson(value);
	return {
		disclaimer: str(row.disclaimer, DISCLAIMER),
		date: str(row.date),
		challenges: Array.isArray(row.challenges) ? row.challenges.map(mapStudyChallenge) : [],
		dueFlashcards: num(row.due_flashcards)
	};
}

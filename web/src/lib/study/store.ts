import { DISCLAIMER, TARGET_DAYS, type TargetDays } from './disclaimer';
import { applyGrade, DEFAULT_EASE, shiftDay, type Grade } from './review';
import { matchesNote } from './search';
import { currentStreak, shanghaiToday } from './streak';
import type { StudyCard, StudyChallenge, StudyNote, StudySkill } from './types';

function nid(): string {
	return crypto.randomUUID();
}

function nowIso(): string {
	return new Date().toISOString();
}

export class MemoryStudyStore {
	challenges: StudyChallenge[] = [];
	cards: StudyCard[] = [];
	notes: StudyNote[] = [];
	skills: StudySkill[] = [];

	today(date = shanghaiToday()) {
		return {
			disclaimer: DISCLAIMER,
			date,
			challenges: this.challenges.map((item) => ({
				...item,
				currentStreak: currentStreak(item.checkins, date),
				progressDays: new Set(item.checkins).size,
				checkedInToday: item.checkins.includes(date)
			})),
			dueFlashcards: this.cards.filter((card) => card.nextReviewDate <= date).length
		};
	}

	createChallenge(input: { name: string; targetDays: number; timezone?: string }): StudyChallenge {
		if (!TARGET_DAYS.includes(input.targetDays as TargetDays)) {
			throw new Error('target_days must be 7, 14 or 21');
		}
		const row: StudyChallenge = {
			id: nid(),
			name: input.name.trim(),
			targetDays: input.targetDays as TargetDays,
			startDate: shanghaiToday(),
			timezone: input.timezone ?? 'Asia/Shanghai',
			checkins: []
		};
		this.challenges.unshift(row);
		return row;
	}

	challenge(id: string): StudyChallenge | undefined {
		return this.challenges.find((item) => item.id === id);
	}

	checkin(id: string, day: string): void {
		const row = this.challenge(id);
		if (!row) throw new Error('challenge not found');
		if (row.checkins.includes(day)) return;
		row.checkins.push(day);
	}

	addCard(input: { front: string; back: string; category?: string | null }): StudyCard {
		const row: StudyCard = {
			id: nid(),
			front: input.front,
			back: input.back,
			category: input.category ?? null,
			ease: DEFAULT_EASE,
			intervalDays: 0,
			nextReviewDate: shanghaiToday()
		};
		this.cards.unshift(row);
		return row;
	}

	review(id: string, grade: Grade, today = shanghaiToday()): StudyCard {
		const row = this.cards.find((item) => item.id === id);
		if (!row) throw new Error('card not found');
		const next = applyGrade({ ease: row.ease, intervalDays: row.intervalDays }, grade);
		row.ease = next.ease;
		row.intervalDays = next.intervalDays;
		row.nextReviewDate = shiftDay(today, next.intervalDays);
		return row;
	}

	addNote(input: { title: string; contentMd?: string; tags?: string[] }): StudyNote {
		const row: StudyNote = {
			id: nid(),
			title: input.title.trim(),
			contentMd: input.contentMd ?? '',
			tags: input.tags ?? [],
			updatedAt: nowIso()
		};
		this.notes.unshift(row);
		return row;
	}

	searchNotes(query: string): StudyNote[] {
		return this.notes.filter((note) => matchesNote(note, query));
	}

	toggleSkill(id: string): void {
		const row = this.skills.find((item) => item.id === id);
		if (row) row.unlocked = !row.unlocked;
	}

	addSkill(input: { title: string; parentId?: string | null }): StudySkill {
		const row: StudySkill = {
			id: nid(),
			parentId: input.parentId ?? null,
			title: input.title.trim(),
			unlocked: true,
			sortOrder: this.skills.length
		};
		this.skills.push(row);
		return row;
	}

	applyTemplate(id: 'english-vocab' | 'piano'): StudySkill[] {
		const templates: Record<string, { title: string; parent: number | null; unlocked: boolean }[]> =
			{
				'english-vocab': [
					{ title: '词根', parent: null, unlocked: true },
					{ title: '单词', parent: 0, unlocked: false },
					{ title: '例句', parent: 1, unlocked: false }
				],
				piano: [
					{ title: '识谱', parent: null, unlocked: true },
					{ title: '音阶', parent: 0, unlocked: false },
					{ title: '曲目', parent: 1, unlocked: false }
				]
			};
		const created: StudySkill[] = [];
		for (const node of templates[id]) {
			const row: StudySkill = {
				id: nid(),
				parentId: node.parent === null ? null : created[node.parent].id,
				title: node.title,
				unlocked: node.unlocked,
				sortOrder: this.skills.length
			};
			this.skills.push(row);
			created.push(row);
		}
		return created;
	}
}

let singleton: MemoryStudyStore | undefined;

export function getStudyStore(): MemoryStudyStore {
	singleton ??= new MemoryStudyStore();
	return singleton;
}

export function resetStudyStore(): void {
	singleton = new MemoryStudyStore();
}

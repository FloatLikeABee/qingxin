import { getApi } from '../api/client';
import { ApiError } from '../api/types';
import { getRecord, openQingxinDb, putRecord } from '../offline/cache';
import { DISCLAIMER } from './disclaimer';
import type { TargetDays } from './disclaimer';
import { matchesNote } from './search';
import { shanghaiToday } from './streak';
import type { Grade } from './review';
import type { StudyCard, StudyChallenge, StudyNote, StudySkill, StudySkillTemplate } from './types';

const CACHE_STORE = 'study';

function plain<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

interface StudySnapshot {
	challenges: StudyChallenge[];
	cards: StudyCard[];
	notes: StudyNote[];
	skills: StudySkill[];
	templates: StudySkillTemplate[];
	dueFlashcards: number;
	date: string;
	disclaimer: string;
}

export class StudyStore {
	challenges = $state<StudyChallenge[]>([]);
	cards = $state<StudyCard[]>([]);
	notes = $state<StudyNote[]>([]);
	skills = $state<StudySkill[]>([]);
	templates = $state<StudySkillTemplate[]>([]);
	dueFlashcards = $state(0);
	date = $state(shanghaiToday());
	disclaimer = $state(DISCLAIMER);
	error = $state<string | null>(null);
	#seq = 0;

	today(date = this.date) {
		return {
			disclaimer: this.disclaimer,
			date,
			challenges: this.challenges,
			dueFlashcards: this.dueFlashcards
		};
	}

	challenge(id: string): StudyChallenge | undefined {
		return this.challenges.find((item) => item.id === id);
	}

	searchNotes(query: string): StudyNote[] {
		return this.notes.filter((note) => matchesNote(note, query));
	}

	async load(): Promise<void> {
		const seq = ++this.#seq;
		const cached = await loadCachedStudy();
		if (cached && seq === this.#seq) this.#apply(cached);
		try {
			const api = getApi();
			const [snap, cards, notes, skills, templates] = await Promise.all([
				api.getStudyToday(),
				api.listStudyFlashcards(),
				api.listStudyNotes(),
				api.listStudySkills(),
				api.listStudySkillTemplates()
			]);
			if (seq !== this.#seq) return;
			this.challenges = snap.challenges;
			this.dueFlashcards = snap.dueFlashcards;
			this.date = snap.date;
			this.disclaimer = snap.disclaimer;
			this.cards = cards;
			this.notes = notes;
			this.skills = skills;
			this.templates = templates;
			this.error = null;
			await cacheStudy(this.#snapshot());
		} catch (error) {
			if (seq !== this.#seq) return;
			this.error = error instanceof ApiError ? error.message : '无法加载学习记录';
			if (!cached) throw error;
		}
	}

	async createChallenge(input: {
		name: string;
		targetDays: number;
		timezone?: string;
	}): Promise<StudyChallenge> {
		this.#seq += 1;
		const saved = await getApi().createStudyChallenge({
			name: input.name,
			targetDays: input.targetDays as TargetDays,
			timezone: input.timezone
		});
		this.challenges = [saved, ...this.challenges];
		await cacheStudy(this.#snapshot());
		return saved;
	}

	async checkin(id: string, day?: string): Promise<void> {
		this.#seq += 1;
		const row = await getApi().checkinStudyChallenge(id, day);
		this.challenges = this.challenges.map((item) => {
			if (item.id !== id) return item;
			const checkins = item.checkins.includes(row.day)
				? item.checkins
				: [...item.checkins, row.day];
			return {
				...item,
				checkins,
				checkedInToday: true,
				progressDays: new Set(checkins).size,
				currentStreak: Math.max(item.currentStreak, 1)
			};
		});
		const snap = await getApi().getStudyToday();
		this.challenges = snap.challenges;
		this.dueFlashcards = snap.dueFlashcards;
		this.date = snap.date;
		await cacheStudy(this.#snapshot());
	}

	async addCard(input: {
		front: string;
		back: string;
		category?: string | null;
	}): Promise<StudyCard> {
		this.#seq += 1;
		const saved = await getApi().createStudyFlashcard(input);
		this.cards = [saved, ...this.cards];
		await cacheStudy(this.#snapshot());
		return saved;
	}

	async review(id: string, grade: Grade): Promise<StudyCard> {
		this.#seq += 1;
		const saved = await getApi().reviewStudyFlashcard(id, grade);
		this.cards = this.cards.map((item) => (item.id === id ? saved : item));
		this.dueFlashcards = this.cards.filter((card) => card.nextReviewDate <= shanghaiToday()).length;
		await cacheStudy(this.#snapshot());
		return saved;
	}

	async addNote(input: { title: string; contentMd?: string; tags?: string[] }): Promise<StudyNote> {
		this.#seq += 1;
		const saved = await getApi().createStudyNote(input);
		this.notes = [saved, ...this.notes];
		await cacheStudy(this.#snapshot());
		return saved;
	}

	async addSkill(input: { title: string; parentId?: string | null }): Promise<StudySkill> {
		this.#seq += 1;
		const saved = await getApi().createStudySkill(input);
		this.skills = [...this.skills, saved];
		await cacheStudy(this.#snapshot());
		return saved;
	}

	async toggleSkill(id: string): Promise<void> {
		const row = this.skills.find((item) => item.id === id);
		if (!row) return;
		this.#seq += 1;
		const saved = await getApi().patchStudySkill(id, { unlocked: !row.unlocked });
		this.skills = this.skills.map((item) => (item.id === id ? saved : item));
		await cacheStudy(this.#snapshot());
	}

	async applyTemplate(id: string): Promise<StudySkill[]> {
		this.#seq += 1;
		const created = await getApi().copyStudySkillTemplate(id);
		this.skills = [...this.skills, ...created];
		await cacheStudy(this.#snapshot());
		return created;
	}

	#apply(snapshot: StudySnapshot): void {
		this.challenges = snapshot.challenges;
		this.cards = snapshot.cards;
		this.notes = snapshot.notes;
		this.skills = snapshot.skills;
		this.templates = snapshot.templates;
		this.dueFlashcards = snapshot.dueFlashcards;
		this.date = snapshot.date;
		this.disclaimer = snapshot.disclaimer;
	}

	#snapshot(): StudySnapshot {
		return {
			challenges: this.challenges,
			cards: this.cards,
			notes: this.notes,
			skills: this.skills,
			templates: this.templates,
			dueFlashcards: this.dueFlashcards,
			date: this.date,
			disclaimer: this.disclaimer
		};
	}
}

let singleton: StudyStore | undefined;

export function getStudyStore(): StudyStore {
	singleton ??= new StudyStore();
	return singleton;
}

export function resetStudyStore(next = new StudyStore()): StudyStore {
	singleton = next;
	return next;
}

async function cacheStudy(snapshot: StudySnapshot): Promise<void> {
	const db = await openQingxinDb();
	try {
		await putRecord(db, CACHE_STORE, 'snapshot', plain(snapshot));
	} finally {
		db.close();
	}
}

async function loadCachedStudy(): Promise<StudySnapshot | undefined> {
	try {
		const db = await openQingxinDb();
		try {
			return await getRecord<StudySnapshot>(db, CACHE_STORE, 'snapshot');
		} finally {
			db.close();
		}
	} catch {
		return undefined;
	}
}

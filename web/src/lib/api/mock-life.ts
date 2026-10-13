import { DISCLAIMER as PETS_DISCLAIMER } from '../pets/disclaimer';
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
import { CARE_TYPES } from '../pets/types';
import { DISCLAIMER as STUDY_DISCLAIMER, TARGET_DAYS, type TargetDays } from '../study/disclaimer';
import { applyGrade, DEFAULT_EASE, shiftDay, type Grade } from '../study/review';
import { matchesNote } from '../study/search';
import { currentStreak, shanghaiToday } from '../study/streak';
import type {
	StudyCard,
	StudyChallenge,
	StudyNote,
	StudySkill,
	StudySkillTemplate
} from '../study/types';
import { ApiError, type Session } from './types';

const SKILL_TEMPLATES: StudySkillTemplate[] = [
	{
		id: 'english-vocab',
		title: '英语词汇',
		nodes: [
			{ key: 'roots', title: '词根', parent: null, unlocked: true },
			{ key: 'words', title: '单词', parent: 'roots', unlocked: false },
			{ key: 'sentences', title: '例句', parent: 'words', unlocked: false }
		]
	},
	{
		id: 'piano',
		title: '钢琴',
		nodes: [
			{ key: 'read', title: '识谱', parent: null, unlocked: true },
			{ key: 'scale', title: '音阶', parent: 'read', unlocked: false },
			{ key: 'piece', title: '曲目', parent: 'scale', unlocked: false }
		]
	}
];

function nid(): string {
	return crypto.randomUUID();
}

function nowIso(): string {
	return new Date().toISOString();
}

function shanghaiDay(iso = nowIso()): string {
	const local = new Date(new Date(iso).getTime() + 8 * 3600_000);
	return local.toISOString().slice(0, 10);
}

function listOf<T>(map: Map<string, T[]>, userId: string): T[] {
	return map.get(userId) ?? [];
}

function setList<T>(map: Map<string, T[]>, userId: string, items: T[]): T[] {
	map.set(userId, items);
	return items;
}

export class MockPetsStudy {
	#pets = new Map<string, Pet[]>();
	#records = new Map<string, PetRecord[]>();
	#weights = new Map<string, PetWeight[]>();
	#logs = new Map<string, PetLog[]>();
	#challenges = new Map<string, StudyChallenge[]>();
	#cards = new Map<string, StudyCard[]>();
	#notes = new Map<string, StudyNote[]>();
	#skills = new Map<string, StudySkill[]>();

	hydrate(userId: string): void {
		if (!this.#pets.has(userId)) this.#pets.set(userId, []);
		if (!this.#records.has(userId)) this.#records.set(userId, []);
		if (!this.#weights.has(userId)) this.#weights.set(userId, []);
		if (!this.#logs.has(userId)) this.#logs.set(userId, []);
		if (!this.#challenges.has(userId)) this.#challenges.set(userId, []);
		if (!this.#cards.has(userId)) this.#cards.set(userId, []);
		if (!this.#notes.has(userId)) this.#notes.set(userId, []);
		if (!this.#skills.has(userId)) this.#skills.set(userId, []);
	}

	forget(userId: string): void {
		this.#pets.delete(userId);
		this.#records.delete(userId);
		this.#weights.delete(userId);
		this.#logs.delete(userId);
		this.#challenges.delete(userId);
		this.#cards.delete(userId);
		this.#notes.delete(userId);
		this.#skills.delete(userId);
	}

	async listPets(session: Session): Promise<Pet[]> {
		this.hydrate(session.userId);
		return [...listOf(this.#pets, session.userId)];
	}

	async createPet(session: Session, input: CreatePetInput): Promise<Pet> {
		this.hydrate(session.userId);
		const name = input.name.trim();
		if (!name) throw new ApiError('invalid_request', 'name must be 1-40 characters');
		const now = nowIso();
		const pets = listOf(this.#pets, session.userId);
		const pet: Pet = {
			id: nid(),
			name,
			species: input.species,
			breed: input.breed?.trim() || null,
			birthday: input.birthday || null,
			avatarUrl: input.avatarUrl?.trim() || null,
			sortOrder: pets.length + 1,
			createdAt: now,
			updatedAt: now
		};
		setList(this.#pets, session.userId, [...pets, pet]);
		return pet;
	}

	async getPet(session: Session, id: string): Promise<Pet> {
		const pet = (await this.listPets(session)).find((item) => item.id === id);
		if (!pet) throw new ApiError('not_found', 'not found');
		return pet;
	}

	async getPetsToday(session: Session): Promise<TodaySummary> {
		this.hydrate(session.userId);
		const day = shanghaiToday();
		const pets = listOf(this.#pets, session.userId);
		const logs = listOf(this.#logs, session.userId);
		const records = listOf(this.#records, session.userId);
		return {
			disclaimer: PETS_DISCLAIMER,
			items: pets.map((pet) => {
				const done = { feed: 0, walk: 0, groom: 0, litter: 0 };
				for (const type of CARE_TYPES) {
					done[type] = logs.filter(
						(log) => log.petId === pet.id && log.type === type && shanghaiDay(log.loggedAt) === day
					).length;
				}
				const horizon = shiftDay(day, 14);
				return {
					petId: pet.id,
					name: pet.name,
					species: pet.species,
					avatarUrl: pet.avatarUrl,
					done,
					dues: records.filter(
						(record) =>
							record.petId === pet.id && record.nextDueDate && record.nextDueDate <= horizon
					)
				};
			})
		};
	}

	async listPetRecords(session: Session, petId: string): Promise<PetRecord[]> {
		await this.getPet(session, petId);
		return listOf(this.#records, session.userId).filter((row) => row.petId === petId);
	}

	async createPetRecord(
		session: Session,
		petId: string,
		input: { type: RecordType; date: string; nextDueDate?: string | null; note?: string | null }
	): Promise<PetRecord> {
		await this.getPet(session, petId);
		const now = nowIso();
		const row: PetRecord = {
			id: nid(),
			petId,
			type: input.type,
			date: input.date,
			nextDueDate: input.nextDueDate || null,
			note: input.note?.trim() || null,
			createdAt: now,
			updatedAt: now,
			disclaimer: PETS_DISCLAIMER
		};
		setList(this.#records, session.userId, [row, ...listOf(this.#records, session.userId)]);
		return row;
	}

	async listPetWeights(session: Session, petId: string): Promise<PetWeight[]> {
		await this.getPet(session, petId);
		return listOf(this.#weights, session.userId)
			.filter((row) => row.petId === petId)
			.sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));
	}

	async createPetWeight(
		session: Session,
		petId: string,
		input: { measuredOn: string; weightG: number }
	): Promise<PetWeight> {
		await this.getPet(session, petId);
		if (!(input.weightG > 0)) throw new ApiError('invalid_request', 'weight_g must be positive');
		const row: PetWeight = {
			id: nid(),
			petId,
			measuredOn: input.measuredOn,
			weightG: input.weightG,
			createdAt: nowIso()
		};
		setList(this.#weights, session.userId, [...listOf(this.#weights, session.userId), row]);
		return row;
	}

	async listPetLogs(session: Session, petId: string): Promise<PetLog[]> {
		await this.getPet(session, petId);
		return listOf(this.#logs, session.userId).filter((row) => row.petId === petId);
	}

	async createPetLog(
		session: Session,
		petId: string,
		input: { type: CareType; value?: string | null }
	): Promise<PetLog> {
		await this.getPet(session, petId);
		const now = nowIso();
		const row: PetLog = {
			id: nid(),
			petId,
			type: input.type,
			value: input.value?.trim() || null,
			loggedAt: now,
			createdAt: now
		};
		setList(this.#logs, session.userId, [row, ...listOf(this.#logs, session.userId)]);
		return row;
	}

	#decorate(row: StudyChallenge, today: string): StudyChallenge {
		return {
			...row,
			currentStreak: currentStreak(row.checkins, today),
			progressDays: new Set(row.checkins).size,
			checkedInToday: row.checkins.includes(today)
		};
	}

	async getStudyToday(session: Session) {
		this.hydrate(session.userId);
		const today = shanghaiToday();
		const cards = listOf(this.#cards, session.userId);
		return {
			disclaimer: STUDY_DISCLAIMER,
			date: today,
			challenges: listOf(this.#challenges, session.userId).map((row) => this.#decorate(row, today)),
			dueFlashcards: cards.filter((card) => card.nextReviewDate <= today).length
		};
	}

	async listStudyChallenges(session: Session): Promise<StudyChallenge[]> {
		this.hydrate(session.userId);
		const today = shanghaiToday();
		return listOf(this.#challenges, session.userId).map((row) => this.#decorate(row, today));
	}

	async createStudyChallenge(
		session: Session,
		input: { name: string; targetDays: TargetDays; timezone?: string }
	): Promise<StudyChallenge> {
		this.hydrate(session.userId);
		if (!TARGET_DAYS.includes(input.targetDays)) {
			throw new ApiError('invalid_request', 'target_days must be 7, 14 or 21');
		}
		const today = shanghaiToday();
		const row: StudyChallenge = {
			id: nid(),
			name: input.name.trim(),
			targetDays: input.targetDays,
			startDate: today,
			timezone: input.timezone ?? 'Asia/Shanghai',
			checkins: [],
			currentStreak: 0,
			progressDays: 0,
			checkedInToday: false
		};
		setList(this.#challenges, session.userId, [row, ...listOf(this.#challenges, session.userId)]);
		return this.#decorate(row, today);
	}

	async checkinStudyChallenge(
		session: Session,
		id: string,
		day?: string
	): Promise<{ id: string; challengeId: string; day: string; createdAt: string }> {
		this.hydrate(session.userId);
		const challenges = listOf(this.#challenges, session.userId);
		const row = challenges.find((item) => item.id === id);
		if (!row) throw new ApiError('not_found', 'not found');
		const when = day || shanghaiToday();
		if (!row.checkins.includes(when)) row.checkins.push(when);
		return { id: nid(), challengeId: id, day: when, createdAt: nowIso() };
	}

	async listStudyFlashcards(session: Session): Promise<StudyCard[]> {
		this.hydrate(session.userId);
		return [...listOf(this.#cards, session.userId)];
	}

	async listDueStudyFlashcards(session: Session): Promise<StudyCard[]> {
		const today = shanghaiToday();
		return (await this.listStudyFlashcards(session)).filter((card) => card.nextReviewDate <= today);
	}

	async createStudyFlashcard(
		session: Session,
		input: { front: string; back: string; category?: string | null }
	): Promise<StudyCard> {
		this.hydrate(session.userId);
		const row: StudyCard = {
			id: nid(),
			front: input.front,
			back: input.back,
			category: input.category?.trim() || null,
			ease: DEFAULT_EASE,
			intervalDays: 0,
			nextReviewDate: shanghaiToday()
		};
		setList(this.#cards, session.userId, [row, ...listOf(this.#cards, session.userId)]);
		return row;
	}

	async reviewStudyFlashcard(session: Session, id: string, grade: Grade): Promise<StudyCard> {
		this.hydrate(session.userId);
		const cards = listOf(this.#cards, session.userId);
		const row = cards.find((item) => item.id === id);
		if (!row) throw new ApiError('not_found', 'not found');
		const next = applyGrade({ ease: row.ease, intervalDays: row.intervalDays }, grade);
		row.ease = next.ease;
		row.intervalDays = next.intervalDays;
		row.nextReviewDate = shiftDay(shanghaiToday(), next.intervalDays);
		return row;
	}

	async listStudyNotes(session: Session, q?: string): Promise<StudyNote[]> {
		this.hydrate(session.userId);
		return listOf(this.#notes, session.userId).filter((note) => matchesNote(note, q ?? ''));
	}

	async createStudyNote(
		session: Session,
		input: { title: string; contentMd?: string; tags?: string[] }
	): Promise<StudyNote> {
		this.hydrate(session.userId);
		const row: StudyNote = {
			id: nid(),
			title: input.title.trim(),
			contentMd: input.contentMd ?? '',
			tags: input.tags ?? [],
			updatedAt: nowIso()
		};
		setList(this.#notes, session.userId, [row, ...listOf(this.#notes, session.userId)]);
		return row;
	}

	async listStudySkills(session: Session): Promise<StudySkill[]> {
		this.hydrate(session.userId);
		return [...listOf(this.#skills, session.userId)];
	}

	async createStudySkill(
		session: Session,
		input: { title: string; parentId?: string | null }
	): Promise<StudySkill> {
		this.hydrate(session.userId);
		const skills = listOf(this.#skills, session.userId);
		const row: StudySkill = {
			id: nid(),
			parentId: input.parentId ?? null,
			title: input.title.trim(),
			unlocked: true,
			sortOrder: skills.length
		};
		setList(this.#skills, session.userId, [...skills, row]);
		return row;
	}

	async patchStudySkill(
		session: Session,
		id: string,
		patch: { title?: string; parentId?: string | null; unlocked?: boolean; sortOrder?: number }
	): Promise<StudySkill> {
		this.hydrate(session.userId);
		const skills = listOf(this.#skills, session.userId);
		const row = skills.find((item) => item.id === id);
		if (!row) throw new ApiError('not_found', 'not found');
		if (patch.title !== undefined) row.title = patch.title;
		if (patch.parentId !== undefined) row.parentId = patch.parentId;
		if (patch.unlocked !== undefined) row.unlocked = patch.unlocked;
		if (patch.sortOrder !== undefined) row.sortOrder = patch.sortOrder;
		return row;
	}

	async listStudySkillTemplates(_session: Session): Promise<StudySkillTemplate[]> {
		return SKILL_TEMPLATES.map((item) => ({
			...item,
			nodes: item.nodes.map((node) => ({ ...node }))
		}));
	}

	async copyStudySkillTemplate(session: Session, templateId: string): Promise<StudySkill[]> {
		const template = SKILL_TEMPLATES.find((item) => item.id === templateId);
		if (!template) throw new ApiError('not_found', 'not found');
		this.hydrate(session.userId);
		const ids = new Map<string, string>();
		const created: StudySkill[] = [];
		for (const [index, node] of template.nodes.entries()) {
			const row: StudySkill = {
				id: nid(),
				parentId: node.parent ? (ids.get(node.parent) ?? null) : null,
				title: node.title,
				unlocked: node.unlocked,
				sortOrder: listOf(this.#skills, session.userId).length + index
			};
			ids.set(node.key, row.id);
			created.push(row);
		}
		setList(this.#skills, session.userId, [...listOf(this.#skills, session.userId), ...created]);
		return created;
	}
}

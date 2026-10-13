import { getApi } from '../api/client';
import { ApiError } from '../api/types';
import { enqueueSync, getRecord, openQingxinDb, putRecord } from '../offline/cache';
import { DISCLAIMER } from './disclaimer';
import type {
	CareType,
	CreatePetInput,
	Pet,
	PetLog,
	PetRecord,
	PetWeight,
	RecordType,
	TodaySummary
} from './types';

const CACHE_STORE = 'pets';

function plain<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

interface PetsSnapshot {
	pets: Pet[];
	records: PetRecord[];
	weights: PetWeight[];
	logs: PetLog[];
	summary: TodaySummary;
}

export class PetsStore {
	pets = $state<Pet[]>([]);
	records = $state<PetRecord[]>([]);
	weights = $state<PetWeight[]>([]);
	logs = $state<PetLog[]>([]);
	summary = $state<TodaySummary>({ items: [], disclaimer: DISCLAIMER });
	error = $state<string | null>(null);
	#seq = 0;

	pet(id: string): Pet | undefined {
		return this.pets.find((item) => item.id === id);
	}

	recordsFor(petId: string): PetRecord[] {
		return this.records.filter((row) => row.petId === petId);
	}

	weightsFor(petId: string): PetWeight[] {
		return this.weights.filter((row) => row.petId === petId);
	}

	today(): TodaySummary {
		return this.summary;
	}

	async load(): Promise<void> {
		const seq = ++this.#seq;
		const cached = await loadCachedPets();
		if (cached && seq === this.#seq) this.#apply(cached);
		try {
			const api = getApi();
			const [pets, summary] = await Promise.all([api.listPets(), api.getPetsToday()]);
			const extras = await Promise.all(
				pets.map(async (pet) => {
					const [records, weights, logs] = await Promise.all([
						api.listPetRecords(pet.id),
						api.listPetWeights(pet.id),
						api.listPetLogs(pet.id)
					]);
					return { records, weights, logs };
				})
			);
			if (seq !== this.#seq) return;
			this.pets = pets;
			this.summary = summary;
			this.records = extras.flatMap((item) => item.records);
			this.weights = extras.flatMap((item) => item.weights);
			this.logs = extras.flatMap((item) => item.logs);
			this.error = null;
			await cachePets(this.#snapshot());
		} catch (error) {
			if (seq !== this.#seq) return;
			this.error = error instanceof ApiError ? error.message : '无法加载宠物';
			if (!cached) throw error;
		}
	}

	async createPet(input: CreatePetInput): Promise<Pet> {
		this.#seq += 1;
		const now = new Date().toISOString();
		const pending: Pet = {
			id: crypto.randomUUID(),
			name: input.name.trim(),
			species: input.species,
			breed: input.breed?.trim() || null,
			birthday: input.birthday || null,
			avatarUrl: input.avatarUrl?.trim() || null,
			sortOrder: this.pets.length + 1,
			createdAt: now,
			updatedAt: now
		};
		this.pets = [...this.pets, pending];
		try {
			const saved = await getApi().createPet(input);
			this.pets = this.pets.map((item) => (item.id === pending.id ? saved : item));
			this.summary = await getApi().getPetsToday();
			await cachePets(this.#snapshot());
			return saved;
		} catch (error) {
			if (offline()) {
				await enqueuePetsOp('pet_create', { ...input, id: pending.id });
				return pending;
			}
			this.pets = this.pets.filter((item) => item.id !== pending.id);
			throw error;
		}
	}

	async addLog(petId: string, input: { type: CareType; value?: string | null }): Promise<PetLog> {
		this.#seq += 1;
		const saved = await getApi().createPetLog(petId, input);
		this.logs = [saved, ...this.logs];
		this.summary = await getApi().getPetsToday();
		await cachePets(this.#snapshot());
		return saved;
	}

	async addRecord(
		petId: string,
		input: { type: RecordType; date: string; nextDueDate?: string | null; note?: string | null }
	): Promise<PetRecord> {
		this.#seq += 1;
		const saved = await getApi().createPetRecord(petId, input);
		this.records = [saved, ...this.records];
		this.summary = await getApi().getPetsToday();
		await cachePets(this.#snapshot());
		return saved;
	}

	async addWeight(
		petId: string,
		input: { measuredOn: string; weightG: number }
	): Promise<PetWeight> {
		this.#seq += 1;
		const saved = await getApi().createPetWeight(petId, input);
		this.weights = [...this.weights, saved].sort((a, b) =>
			a.measuredOn.localeCompare(b.measuredOn)
		);
		await cachePets(this.#snapshot());
		return saved;
	}

	#apply(snapshot: PetsSnapshot): void {
		this.pets = snapshot.pets;
		this.records = snapshot.records;
		this.weights = snapshot.weights;
		this.logs = snapshot.logs;
		this.summary = snapshot.summary;
	}

	#snapshot(): PetsSnapshot {
		return {
			pets: this.pets,
			records: this.records,
			weights: this.weights,
			logs: this.logs,
			summary: this.summary
		};
	}
}

let singleton: PetsStore | undefined;

export function getPetsStore(): PetsStore {
	singleton ??= new PetsStore();
	return singleton;
}

export function resetPetsStore(next = new PetsStore()): PetsStore {
	singleton = next;
	return next;
}

function offline(): boolean {
	return typeof navigator !== 'undefined' && navigator.onLine === false;
}

async function cachePets(snapshot: PetsSnapshot): Promise<void> {
	const db = await openQingxinDb();
	try {
		await putRecord(db, CACHE_STORE, 'snapshot', plain(snapshot));
	} finally {
		db.close();
	}
}

async function loadCachedPets(): Promise<PetsSnapshot | undefined> {
	try {
		const db = await openQingxinDb();
		try {
			return await getRecord<PetsSnapshot>(db, CACHE_STORE, 'snapshot');
		} finally {
			db.close();
		}
	} catch {
		return undefined;
	}
}

async function enqueuePetsOp(type: string, payload: unknown): Promise<void> {
	const db = await openQingxinDb();
	try {
		await enqueueSync(db, { type, payload });
	} finally {
		db.close();
	}
}

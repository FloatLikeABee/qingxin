import { DISCLAIMER } from './disclaimer';
import type {
	CareType,
	Pet,
	PetLog,
	PetRecord,
	PetReminder,
	PetSpecies,
	PetWeight,
	RecordType,
	TodaySummary
} from './types';
import { CARE_TYPES } from './types';

function nowIso(): string {
	return new Date().toISOString();
}

function shanghaiDay(iso = nowIso()): string {
	const local = new Date(new Date(iso).getTime() + 8 * 3600_000);
	return local.toISOString().slice(0, 10);
}

export interface CreatePetInput {
	name: string;
	species: PetSpecies;
	breed?: string | null;
	birthday?: string | null;
	avatarUrl?: string | null;
}

export class MemoryPetsStore {
	pets: Pet[] = [];
	records: PetRecord[] = [];
	weights: PetWeight[] = [];
	logs: PetLog[] = [];
	reminders: PetReminder[] = [];

	createPet(input: CreatePetInput): Pet {
		const now = nowIso();
		const pet: Pet = {
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
		this.pets.push(pet);
		return pet;
	}

	pet(id: string): Pet | undefined {
		return this.pets.find((item) => item.id === id);
	}

	addLog(petId: string, input: { type: CareType; value?: string | null }): PetLog {
		const now = nowIso();
		const row: PetLog = {
			id: crypto.randomUUID(),
			petId,
			type: input.type,
			value: input.value?.trim() || null,
			loggedAt: now,
			createdAt: now
		};
		this.logs.unshift(row);
		return row;
	}

	addRecord(
		petId: string,
		input: { type: RecordType; date: string; nextDueDate?: string | null; note?: string | null }
	): PetRecord {
		const now = nowIso();
		const row: PetRecord = {
			id: crypto.randomUUID(),
			petId,
			type: input.type,
			date: input.date,
			nextDueDate: input.nextDueDate || null,
			note: input.note?.trim() || null,
			createdAt: now,
			updatedAt: now,
			disclaimer: DISCLAIMER
		};
		this.records.unshift(row);
		return row;
	}

	addWeight(petId: string, input: { measuredOn: string; weightG: number }): PetWeight {
		const row: PetWeight = {
			id: crypto.randomUUID(),
			petId,
			measuredOn: input.measuredOn,
			weightG: input.weightG,
			createdAt: nowIso()
		};
		this.weights.push(row);
		this.weights.sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));
		return row;
	}

	today(): TodaySummary {
		const day = shanghaiDay();
		return {
			disclaimer: DISCLAIMER,
			items: this.pets.map((pet) => {
				const done = { feed: 0, walk: 0, groom: 0, litter: 0 };
				for (const type of CARE_TYPES) {
					done[type] = this.logs.filter(
						(log) => log.petId === pet.id && log.type === type && shanghaiDay(log.loggedAt) === day
					).length;
				}
				return {
					petId: pet.id,
					name: pet.name,
					species: pet.species,
					avatarUrl: pet.avatarUrl,
					done,
					dues: this.records.filter((record) => record.petId === pet.id && record.nextDueDate)
				};
			})
		};
	}

	recordsFor(petId: string): PetRecord[] {
		return this.records.filter((row) => row.petId === petId);
	}

	weightsFor(petId: string): PetWeight[] {
		return this.weights.filter((row) => row.petId === petId);
	}
}

let singleton: MemoryPetsStore | undefined;

export function getPetsStore(): MemoryPetsStore {
	singleton ??= new MemoryPetsStore();
	return singleton;
}

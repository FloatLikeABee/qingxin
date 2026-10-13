import type {
	CareType,
	Pet,
	PetLog,
	PetRecord,
	PetSpecies,
	PetWeight,
	RecordType,
	TodayDone,
	TodayItem,
	TodaySummary
} from './types';
import { DISCLAIMER } from './disclaimer';

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

export function petWriteBody(input: {
	name: string;
	species: PetSpecies;
	breed?: string | null;
	birthday?: string | null;
	avatarUrl?: string | null;
}): Json {
	return omitBlank({
		name: input.name.trim(),
		species: input.species,
		breed: input.breed?.trim() || undefined,
		birthday: input.birthday || undefined,
		avatar_url: input.avatarUrl?.trim() || undefined
	});
}

export function petRecordWriteBody(input: {
	type: RecordType;
	date: string;
	nextDueDate?: string | null;
	note?: string | null;
}): Json {
	return omitBlank({
		type: input.type,
		date: input.date,
		next_due_date: input.nextDueDate || undefined,
		note: input.note?.trim() || undefined
	});
}

export function petWeightWriteBody(input: { measuredOn: string; weightG: number }): Json {
	return omitBlank({
		measured_on: input.measuredOn,
		weight_g: input.weightG
	});
}

export function petLogWriteBody(input: { type: CareType; value?: string | null }): Json {
	return omitBlank({
		type: input.type,
		value: input.value?.trim() || undefined
	});
}

export function mapPet(value: unknown): Pet {
	const row = asJson(value);
	return {
		id: str(row.id),
		name: str(row.name),
		species: str(row.species) as PetSpecies,
		breed: row.breed == null || row.breed === '' ? null : str(row.breed),
		birthday: row.birthday == null || row.birthday === '' ? null : str(row.birthday),
		avatarUrl: row.avatar_url == null || row.avatar_url === '' ? null : str(row.avatar_url),
		sortOrder: num(row.sort_order),
		createdAt: str(row.created_at),
		updatedAt: str(row.updated_at)
	};
}

export function mapPetList(value: unknown): Pet[] {
	return itemsOf(value).map(mapPet);
}

export function mapPetRecord(value: unknown): PetRecord {
	const row = asJson(value);
	return {
		id: str(row.id),
		petId: str(row.pet_id),
		type: str(row.type) as RecordType,
		date: str(row.date),
		nextDueDate:
			row.next_due_date == null || row.next_due_date === '' ? null : str(row.next_due_date),
		note: row.note == null || row.note === '' ? null : str(row.note),
		createdAt: str(row.created_at),
		updatedAt: str(row.updated_at),
		disclaimer: str(row.disclaimer, DISCLAIMER)
	};
}

export function mapPetRecordList(value: unknown): PetRecord[] {
	return itemsOf(value).map(mapPetRecord);
}

export function mapPetWeight(value: unknown): PetWeight {
	const row = asJson(value);
	return {
		id: str(row.id),
		petId: str(row.pet_id),
		measuredOn: str(row.measured_on),
		weightG: num(row.weight_g),
		createdAt: str(row.created_at)
	};
}

export function mapPetWeightList(value: unknown): PetWeight[] {
	return itemsOf(value).map(mapPetWeight);
}

export function mapPetLog(value: unknown): PetLog {
	const row = asJson(value);
	return {
		id: str(row.id),
		petId: str(row.pet_id),
		type: str(row.type) as CareType,
		value: row.value == null || row.value === '' ? null : str(row.value),
		loggedAt: str(row.logged_at),
		createdAt: str(row.created_at)
	};
}

export function mapPetLogList(value: unknown): PetLog[] {
	return itemsOf(value).map(mapPetLog);
}

function mapDone(value: unknown): TodayDone {
	const row = asJson(value);
	return {
		feed: num(row.feed),
		walk: num(row.walk),
		groom: num(row.groom),
		litter: num(row.litter)
	};
}

function mapTodayItem(value: unknown): TodayItem {
	const row = asJson(value);
	return {
		petId: str(row.pet_id),
		name: str(row.name),
		species: str(row.species) as PetSpecies,
		avatarUrl: row.avatar_url == null || row.avatar_url === '' ? null : str(row.avatar_url),
		done: mapDone(row.done),
		dues: Array.isArray(row.dues) ? row.dues.map(mapPetRecord) : []
	};
}

export function mapPetsToday(value: unknown): TodaySummary {
	const row = asJson(value);
	return {
		items: Array.isArray(row.items) ? row.items.map(mapTodayItem) : [],
		disclaimer: str(row.disclaimer, DISCLAIMER)
	};
}

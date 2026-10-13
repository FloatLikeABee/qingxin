export type PetSpecies = 'cat' | 'dog' | 'other';
export type RecordType = 'vaccine' | 'deworm' | 'checkup' | 'vet_visit';
export type CareType = 'feed' | 'walk' | 'groom' | 'litter';

export interface Pet {
	id: string;
	name: string;
	species: PetSpecies;
	breed: string | null;
	birthday: string | null;
	avatarUrl: string | null;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

export interface PetRecord {
	id: string;
	petId: string;
	type: RecordType;
	date: string;
	nextDueDate: string | null;
	note: string | null;
	createdAt: string;
	updatedAt: string;
	disclaimer: string;
}

export interface PetWeight {
	id: string;
	petId: string;
	measuredOn: string;
	weightG: number;
	createdAt: string;
}

export interface PetLog {
	id: string;
	petId: string;
	type: CareType;
	value: string | null;
	loggedAt: string;
	createdAt: string;
}

export interface PetReminder {
	id: string;
	petId: string;
	kind: CareType;
	timeLocal: string;
	daysOfWeek: number[];
	timezone: string;
	active: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface TodayDone {
	feed: number;
	walk: number;
	groom: number;
	litter: number;
}

export interface TodayItem {
	petId: string;
	name: string;
	species: PetSpecies;
	avatarUrl: string | null;
	done: TodayDone;
	dues: PetRecord[];
}

export interface TodaySummary {
	items: TodayItem[];
	disclaimer: string;
}

export const SPECIES_LABEL: Record<PetSpecies, string> = {
	cat: '猫咪',
	dog: '狗狗',
	other: '其他'
};

export const RECORD_LABEL: Record<RecordType, string> = {
	vaccine: '疫苗',
	deworm: '驱虫',
	checkup: '体检',
	vet_visit: '就医'
};

export const CARE_LABEL: Record<CareType, string> = {
	feed: '喂食',
	walk: '遛弯',
	groom: '梳毛',
	litter: '铲屎'
};

export const CARE_TYPES: CareType[] = ['feed', 'walk', 'groom', 'litter'];

import type { TargetDays } from './disclaimer';
import type { Grade } from './review';

export type { Grade, TargetDays };

export interface StudyCheckin {
	id: string;
	challengeId: string;
	day: string;
	createdAt: string;
}

export interface StudyChallenge {
	id: string;
	name: string;
	targetDays: TargetDays;
	startDate: string;
	timezone: string;
	checkins: string[];
}

export interface StudyCard {
	id: string;
	front: string;
	back: string;
	category: string | null;
	ease: number;
	intervalDays: number;
	nextReviewDate: string;
}

export interface StudyNote {
	id: string;
	title: string;
	contentMd: string;
	tags: string[];
	updatedAt: string;
}

export interface StudySkill {
	id: string;
	parentId: string | null;
	title: string;
	unlocked: boolean;
	sortOrder: number;
}

export interface StudyReminder {
	id: string;
	kind: 'streak' | 'review';
	time: string;
	daysOfWeek: number[];
	timezone: string;
	active: boolean;
}

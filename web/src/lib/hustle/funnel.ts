export const APPLICATION_STATUSES = ['投递', '面试', 'Offer'] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface Application {
	id: string;
	company: string;
	position: string;
	status: ApplicationStatus;
	interviewDate?: string | null;
	notes?: string | null;
	createdAt?: string;
	updatedAt?: string;
}

export interface FunnelStage {
	status: ApplicationStatus;
	count: number;
}

export function funnelStages(apps: Application[]): FunnelStage[] {
	return APPLICATION_STATUSES.map((status) => ({
		status,
		count: apps.filter((item) => item.status === status).length
	}));
}

export function isApplicationStatus(value: string): value is ApplicationStatus {
	return (APPLICATION_STATUSES as readonly string[]).includes(value);
}

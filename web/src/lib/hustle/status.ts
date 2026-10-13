import {
	APPLICATION_STATUSES,
	isApplicationStatus,
	type Application,
	type ApplicationStatus
} from './funnel';

export { APPLICATION_STATUSES };

export type StatusTone = 'applied' | 'interview' | 'offer';

export function statusTone(status: ApplicationStatus): StatusTone {
	if (status === 'Offer') return 'offer';
	if (status === '面试') return 'interview';
	return 'applied';
}

export function moveApplication(apps: Application[], id: string, status: string): Application[] {
	if (!isApplicationStatus(status)) {
		throw new Error('invalid_request');
	}
	return apps.map((item) => (item.id === id ? { ...item, status } : item));
}

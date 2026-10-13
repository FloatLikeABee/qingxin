import type { Application } from './funnel';

export interface JobTodo {
	id: string;
	kind: 'interview' | 'followup';
	title: string;
	detail: string;
}

export function todayTodos(apps: Application[], day: string): JobTodo[] {
	const interviews = apps
		.filter((item) => (item.interviewDate ?? '').startsWith(day))
		.map((item) => ({
			id: item.id,
			kind: 'interview' as const,
			title: `${item.company} · ${item.position}`,
			detail: '今日面试'
		}));
	const followups = apps
		.filter((item) => item.status === '投递' && !item.interviewDate)
		.map((item) => ({
			id: item.id,
			kind: 'followup' as const,
			title: `${item.company} · ${item.position}`,
			detail: '待跟进投递'
		}));
	return [...interviews, ...followups];
}

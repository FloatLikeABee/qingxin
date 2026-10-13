import { describe, expect, it } from 'vitest';
import { todayTodos } from './todos';
import type { Application } from './funnel';

describe('todayTodos', () => {
	it('lists interviews on the given day and 投递 follow-ups', () => {
		const apps: Application[] = [
			{
				id: '1',
				company: '轻心实验室',
				position: '前端工程师',
				status: '面试',
				interviewDate: '2026-10-13'
			},
			{ id: '2', company: '河岸工作室', position: '产品', status: '投递' },
			{
				id: '3',
				company: '云停科技',
				position: '运营',
				status: 'Offer',
				interviewDate: '2026-10-01'
			}
		];
		const todos = todayTodos(apps, '2026-10-13');
		expect(todos.map((item) => item.id)).toEqual(['1', '2']);
		expect(todos[0]?.kind).toBe('interview');
		expect(todos[1]?.kind).toBe('followup');
	});
});

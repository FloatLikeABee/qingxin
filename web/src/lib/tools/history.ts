import type { AiTask } from '../api/types';
import { isToolId, type ToolId } from './catalog';

export function filterTasks(tasks: AiTask[], toolId: ToolId | 'all'): AiTask[] {
	const sorted = [...tasks].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
	if (toolId === 'all') return sorted;
	if (!isToolId(toolId)) return [];
	return sorted.filter((item) => item.toolId === toolId);
}

export type TimeBucketId = 'today' | 'week' | 'older';

export interface TimeBucket {
	id: TimeBucketId;
	label: string;
	items: AiTask[];
}

function startOfLocalDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfLocalWeek(date: Date): Date {
	const start = startOfLocalDay(date);
	const weekday = start.getDay();
	const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
	start.setDate(start.getDate() + mondayOffset);
	return start;
}

export function groupTasksByTime(tasks: AiTask[], now: Date = new Date()): TimeBucket[] {
	const todayStart = startOfLocalDay(now);
	const weekStart = startOfLocalWeek(now);
	const buckets: Record<TimeBucketId, TimeBucket> = {
		today: { id: 'today', label: '今天', items: [] },
		week: { id: 'week', label: '本周', items: [] },
		older: { id: 'older', label: '更早', items: [] }
	};
	for (const task of filterTasks(tasks, 'all')) {
		const created = new Date(task.createdAt);
		if (Number.isNaN(created.getTime())) {
			buckets.older.items.push(task);
			continue;
		}
		if (created >= todayStart) buckets.today.items.push(task);
		else if (created >= weekStart) buckets.week.items.push(task);
		else buckets.older.items.push(task);
	}
	return (['today', 'week', 'older'] as const)
		.map((id) => buckets[id])
		.filter((bucket) => bucket.items.length > 0);
}

export const SHIMMER_CLASS = 'qx-shimmer';

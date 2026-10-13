import type { AiTask } from '../api/types';
import { isToolId, type ToolId } from './catalog';

export function filterTasks(tasks: AiTask[], toolId: ToolId | 'all'): AiTask[] {
	const sorted = [...tasks].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
	if (toolId === 'all') return sorted;
	if (!isToolId(toolId)) return [];
	return sorted.filter((item) => item.toolId === toolId);
}

export const SHIMMER_CLASS = 'qx-shimmer';

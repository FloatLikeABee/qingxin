import { describe, expect, it } from 'vitest';
import type { AiTask } from '../api/types';
import { filterTasks, SHIMMER_CLASS } from './history';

const task = (id: string, toolId: AiTask['toolId'], createdAt: string): AiTask => ({
	id,
	toolId,
	inputKind: 'text',
	inputText: 'x',
	inputMeta: {},
	outputText: 'y',
	outputJson: {},
	source: 'mock',
	disclaimer: '不构成',
	createdAt
});

describe('tools history', () => {
	it('filters by tool and newest first', () => {
		const tasks = [
			task('1', 'polish', '2026-10-13T01:00:00Z'),
			task('2', 'summary', '2026-10-13T02:00:00Z'),
			task('3', 'summary', '2026-10-13T03:00:00Z')
		];
		expect(filterTasks(tasks, 'all').map((item) => item.id)).toEqual(['3', '2', '1']);
		expect(filterTasks(tasks, 'summary').map((item) => item.id)).toEqual(['3', '2']);
	});

	it('exports the shimmer class name', () => {
		expect(SHIMMER_CLASS).toBe('qx-shimmer');
	});
});

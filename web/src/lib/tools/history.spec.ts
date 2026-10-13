import { describe, expect, it } from 'vitest';
import type { AiTask } from '../api/types';
import { filterTasks, groupTasksByTime, SHIMMER_CLASS } from './history';

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

	it('groups tasks into 今天, 本周, and 更早', () => {
		const now = new Date(2026, 9, 13, 12, 0, 0);
		const grouped = groupTasksByTime(
			[
				task('today', 'summary', new Date(2026, 9, 13, 10, 0, 0).toISOString()),
				task('week', 'polish', new Date(2026, 9, 12, 10, 0, 0).toISOString()),
				task('older', 'meeting', new Date(2026, 8, 1, 10, 0, 0).toISOString())
			],
			now
		);
		expect(grouped.map((bucket) => bucket.label)).toEqual(['今天', '本周', '更早']);
		expect(grouped[0]?.items.map((item) => item.id)).toEqual(['today']);
		expect(grouped[1]?.items.map((item) => item.id)).toEqual(['week']);
		expect(grouped[2]?.items.map((item) => item.id)).toEqual(['older']);
	});
});

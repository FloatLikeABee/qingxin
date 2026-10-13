import { describe, expect, it } from 'vitest';
import type { AiTask } from '../api/types';
import { taskToMarkdown } from './export';

describe('tools export', () => {
	it('builds markdown with input and output', () => {
		const task: AiTask = {
			id: 't1',
			toolId: 'summary',
			inputKind: 'text',
			inputText: '买菜',
			inputMeta: {},
			outputText: '【示意摘要】买菜。',
			outputJson: {},
			source: 'mock',
			disclaimer: '不构成专业建议。',
			createdAt: '2026-10-13T01:00:00Z'
		};
		const md = taskToMarkdown(task);
		expect(md).toContain('# 摘要');
		expect(md).toContain('买菜');
		expect(md).toContain('【示意摘要】');
		expect(md).toContain('不构成');
	});
});

import { describe, expect, it } from 'vitest';
import { EDITOR_CLASS, EDITOR_COLORS, highlightVariables } from './editor';

describe('create editor island', () => {
	it('keeps a hardcoded dark IDE palette', () => {
		expect(EDITOR_CLASS).toBe('create-editor');
		expect(EDITOR_COLORS.background).toBe('#0F172A');
		expect(EDITOR_COLORS.text).toBe('#E2E8F0');
		expect(EDITOR_COLORS.variable).toBe('#38BDF8');
	});

	it('highlights {{variable}} tokens', () => {
		const parts = highlightVariables('标题：{{主题}} 和 {{关键词}}');
		expect(parts).toEqual([
			{ text: '标题：', kind: 'plain' },
			{ text: '{{主题}}', kind: 'variable' },
			{ text: ' 和 ', kind: 'plain' },
			{ text: '{{关键词}}', kind: 'variable' }
		]);
	});
});

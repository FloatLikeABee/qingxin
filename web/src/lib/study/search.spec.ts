import { describe, expect, it } from 'vitest';
import { matchesNote } from './search';

describe('note search', () => {
	const note = { title: '动词', tags: ['语法'], contentMd: '# 摘要\n秘密句子' };

	it('matches title and tags only', () => {
		expect(matchesNote(note, '动词')).toBe(true);
		expect(matchesNote(note, '语法')).toBe(true);
		expect(matchesNote(note, '秘密句子')).toBe(false);
	});
});

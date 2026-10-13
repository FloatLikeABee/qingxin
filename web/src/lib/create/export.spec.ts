import { describe, expect, it } from 'vitest';
import { outlineToMarkdown, outlineToPptx, unzipStoredStrings } from './export';
import type { CreateOutline } from './catalog';

const outline: CreateOutline = {
	title: '季度复盘',
	slides: [
		{ heading: '封面', bullets: ['季度复盘'] },
		{ heading: '进展', bullets: ['完成两件事'] }
	]
};

describe('outline export', () => {
	it('builds markdown with title and slide headings', () => {
		const md = outlineToMarkdown({ title: '季度复盘', slides: [{ heading: '成果', bullets: [] }] });
		expect(md).toContain('# 季度复盘');
		expect(md).toContain('## 成果');
	});

	it('builds a PPTX zip that contains slide headings', () => {
		const bytes = outlineToPptx(outline);
		expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK');
		const blob = unzipStoredStrings(bytes).join('\n');
		expect(blob).toContain('封面');
		expect(blob).toContain('进展');
	});
});

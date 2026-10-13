import { describe, expect, it } from 'vitest';
import { DISCLAIMER, mockGenerate, mockOutline, mockPolish, mockTitles } from './ai';

describe('create AI stubs', () => {
	it('builds deterministic generate copy from sorted keywords', () => {
		const text = mockGenerate({
			platform: '小红书',
			topic: '阳台种菜',
			keywords: ['番茄', '阳光'],
			tone: '更幽默',
			length: '短'
		});
		expect(text).toBe('【小红书·更幽默·短】阳台种菜：把番茄、阳光写成可收藏的日常。此为示意文案。');
		expect(DISCLAIMER).toContain('不构成');
	});

	it('returns ten titles', () => {
		const titles = mockTitles('阳台种菜');
		expect(titles).toHaveLength(10);
		expect(titles.every((item) => item.includes('阳台种菜'))).toBe(true);
	});

	it('rewrites polish without dropping the source sentence', () => {
		const out = mockPolish('今天写周报', '更幽默');
		expect(out).not.toBe('今天写周报');
		expect(out).toContain('今天写周报');
		expect(out).toContain('更幽默');
	});

	it('builds a three-slide outline and markdown', () => {
		const outline = mockOutline('季度复盘');
		expect(outline.slides.length).toBeGreaterThanOrEqual(3);
		expect(outline.markdown).toContain('# 季度复盘');
		expect(outline.title).toContain('季度复盘');
	});
});

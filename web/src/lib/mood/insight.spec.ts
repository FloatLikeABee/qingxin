import { describe, expect, it } from 'vitest';
import { chunkInsight, DISCLAIMER, mockInsight } from './insight';

describe('mockInsight', () => {
	it('is deterministic for shuffled tags', () => {
		const a = mockInsight('😔', ['工作', '睡眠']);
		const b = mockInsight('😔', ['睡眠', '工作']);
		expect(a).toBe(b);
		expect(a.length).toBeGreaterThan(8);
	});

	it('exposes a non-medical disclaimer', () => {
		expect(DISCLAIMER).toContain('不构成医疗建议');
	});
});

describe('chunkInsight', () => {
	it('splits text into progressive chunks', () => {
		const chunks = chunkInsight('今天有些沉重。先允许自己慢一点。', 4);
		expect(chunks[0]?.length).toBeLessThanOrEqual(4);
		expect(chunks.at(-1)).toBe('今天有些沉重。先允许自己慢一点。');
	});

	it('returns the full text once when reduced motion is on', () => {
		expect(chunkInsight('abcdef', 2, true)).toEqual(['abcdef']);
	});
});

import { describe, expect, it } from 'vitest';
import { mergeCatalog, TOOL_IDS, TOOLS } from './catalog';

describe('tools catalog', () => {
	it('lists eight tools', () => {
		expect(TOOL_IDS).toHaveLength(8);
		expect(TOOLS.map((item) => item.id)).toEqual([...TOOL_IDS]);
		expect(TOOLS.some((item) => item.name === '摘要')).toBe(true);
	});

	it('merges favourites and recents', () => {
		const merged = mergeCatalog(['meeting', 'summary'], ['summary', 'polish']);
		expect(merged.items.find((item) => item.id === 'meeting')?.favourite).toBe(true);
		expect(merged.recent).toEqual(['summary', 'polish']);
		expect(merged.favourites).toEqual(['meeting', 'summary']);
	});
});

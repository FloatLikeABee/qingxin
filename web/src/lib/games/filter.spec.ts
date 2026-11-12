import { describe, expect, it } from 'vitest';
import { GAMES } from './catalog';
import { filterGames } from './filter';

describe('games catalog filter', () => {
	it('returns the full registry for a blank 全部 query', () => {
		expect(filterGames(GAMES, { search: '  ', category: '全部' })).toEqual(GAMES);
	});

	it('matches Chinese title, English title, and tags', () => {
		const byTitle = filterGames(GAMES, { search: '经理' });
		expect(byTitle.some((game) => game.id === 'convenient-store')).toBe(true);
		const byEnglish = filterGames(GAMES, { search: 'Convenient Store' });
		expect(byEnglish.some((game) => game.id === 'convenient-store')).toBe(true);
		const byTag = filterGames(GAMES, { search: '补货' });
		expect(byTag.some((game) => game.id === 'convenient-store')).toBe(true);
	});

	it('filters by category 经营', () => {
		const ops = filterGames(GAMES, { category: '经营' });
		expect(ops.length).toBeGreaterThan(0);
		expect(ops.every((game) => game.category === '经营')).toBe(true);
		expect(ops.some((game) => game.id === 'convenient-store')).toBe(true);
	});
});

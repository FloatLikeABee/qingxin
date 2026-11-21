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

	it('finds 年报 by Chinese title and Annual Report', () => {
		expect(filterGames(GAMES, { search: '年报' }).some((game) => game.id === 'annual-report')).toBe(
			true
		);
		expect(
			filterGames(GAMES, { search: 'Annual Report' }).some((game) => game.id === 'annual-report')
		).toBe(true);
	});

	it('filters by category 经营', () => {
		const ops = filterGames(GAMES, { category: '经营' });
		expect(ops.length).toBeGreaterThan(0);
		expect(ops.every((game) => game.category === '经营')).toBe(true);
		expect(ops.some((game) => game.id === 'convenient-store')).toBe(true);
		expect(ops.some((game) => game.id === 'shangban')).toBe(true);
		expect(ops.some((game) => game.id === 'annual-report')).toBe(true);
	});

	it('finds 上班 by Chinese title and workday tags', () => {
		const byTitle = filterGames(GAMES, { search: '上班' });
		expect(byTitle.some((game) => game.id === 'shangban')).toBe(true);
		const byTag = filterGames(GAMES, { search: '工位' });
		expect(byTag.some((game) => game.id === 'shangban')).toBe(true);
	});

	it('filters by category 飞行', () => {
		const flight = filterGames(GAMES, { category: '飞行' });
		expect(flight.some((game) => game.id === 'sky-sortie')).toBe(true);
		expect(flight.every((game) => game.category === '飞行')).toBe(true);
		expect(flight.some((game) => game.id === 'convenient-store')).toBe(false);
	});

	it('filters by category 驾驶', () => {
		const drive = filterGames(GAMES, { category: '驾驶' });
		expect(drive.some((game) => game.id === 'cargo-haul')).toBe(true);
		expect(drive.every((game) => game.category === '驾驶')).toBe(true);
		expect(drive.some((game) => game.id === 'sky-sortie')).toBe(false);
	});

	it('finds 手术 in 益智 without treating it as full anatomy', () => {
		expect(filterGames(GAMES, { search: '手术' }).some((game) => game.id === 'operation')).toBe(
			true
		);
		const puzzle = filterGames(GAMES, { category: '益智' });
		expect(puzzle.some((game) => game.id === 'operation')).toBe(true);
		expect(puzzle.some((game) => game.id === 'memory-shelf')).toBe(true);
		expect(puzzle.every((game) => game.category === '益智')).toBe(true);
	});
});

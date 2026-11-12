import { describe, expect, it } from 'vitest';
import { featuredGame, GAMES, getGame } from './catalog';

describe('games registry', () => {
	it('lists 便利店经理 as the only playable game', () => {
		const playable = GAMES.filter((game) => game.status === 'playable');
		expect(playable).toHaveLength(1);
		expect(playable[0]).toMatchObject({
			id: 'convenient-store',
			title: '便利店经理',
			englishTitle: 'Convenient Store Manager',
			category: '经营',
			status: 'playable'
		});
		expect(getGame('convenient-store')?.featured).toBe(true);
		expect(featuredGame()?.id).toBe('convenient-store');
	});

	it('keeps designed 即将到来 slots in the catalog', () => {
		const coming = GAMES.filter((game) => game.status === 'coming');
		expect(coming.length).toBeGreaterThanOrEqual(2);
		expect(coming.every((game) => game.title.length > 0 && game.cover.motif)).toBe(true);
		expect(GAMES.every((game) => game.id && game.summary && game.tags.length > 0)).toBe(true);
	});
});

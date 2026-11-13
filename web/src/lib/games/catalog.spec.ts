import { describe, expect, it } from 'vitest';
import { featuredGame, GAMES, getGame } from './catalog';

describe('games registry', () => {
	it('lists three playable games including 街角花店 and 夜窗拼图', () => {
		const playable = GAMES.filter((game) => game.status === 'playable');
		expect(playable.map((game) => game.id).sort()).toEqual(
			['convenient-store', 'corner-florist', 'night-puzzle'].sort()
		);
		expect(getGame('convenient-store')).toMatchObject({
			title: '便利店经理',
			playCta: '开始经营',
			featured: true
		});
		expect(getGame('corner-florist')).toMatchObject({
			title: '街角花店',
			summary: '把当天的花束配齐，等有人推门进来。',
			category: '经营',
			tags: ['花束', '橱窗'],
			status: 'playable',
			playCta: '开始配花'
		});
		expect(getGame('night-puzzle')).toMatchObject({
			title: '夜窗拼图',
			summary: '把窗外那块被风吹乱的夜色拼回去。',
			category: '益智',
			tags: ['夜晚', '拼块'],
			status: 'playable',
			playCta: '开始拼夜'
		});
		expect(featuredGame()?.id).toBe('convenient-store');
	});

	it('keeps the remaining 即将到来 slots', () => {
		const coming = GAMES.filter((game) => game.status === 'coming');
		expect(coming.map((game) => game.id)).toEqual(['tide-breath', 'cloud-walk', 'memory-shelf']);
		expect(
			GAMES.every((game) => game.id && game.summary && game.tags.length > 0 && game.playCta)
		).toBe(true);
	});
});

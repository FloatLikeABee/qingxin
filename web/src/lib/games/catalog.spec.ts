import { describe, expect, it } from 'vitest';
import {
	aliasTarget,
	featuredGame,
	GAMES,
	GAME_CATEGORIES,
	gameHref,
	getGame,
	playHref
} from './catalog';

describe('games registry', () => {
	it('lists 上班 as a playable catalog game with the existing play route', () => {
		const game = getGame('shangban');
		expect(game).toMatchObject({
			id: 'shangban',
			title: '上班',
			englishTitle: 'Workday',
			status: 'playable',
			category: '经营',
			playCta: '开始上班'
		});
		expect(playHref(game!)).toBe('/modules/games/shangban/play');
		expect(gameHref(game!)).toBe('/modules/games/shangban');
		expect(featuredGame()?.id).toBe('convenient-store');
	});

	it('lists playable games including 窗前庭园, 晴空出击, 潮汐呼吸, 云上散步, 记忆货架, and 上班', () => {
		const playable = GAMES.filter((game) => game.status === 'playable');
		expect(playable.map((game) => game.id).sort()).toEqual(
			[
				'cloud-walk',
				'convenient-store',
				'memory-shelf',
				'shangban',
				'sky-sortie',
				'tide-breath',
				'window-garden'
			].sort()
		);
		expect(getGame('convenient-store')).toMatchObject({
			title: '便利店经理',
			playCta: '开始经营',
			featured: true
		});
		expect(getGame('window-garden')).toMatchObject({
			title: '窗前庭园',
			summary: '种十种常见蔬菜，认出益虫和害虫。园子没有通关。',
			category: '经营',
			tags: ['种植', '虫鸣'],
			status: 'playable',
			playCta: '开始种植'
		});
		expect(getGame('sky-sortie')).toMatchObject({
			title: '晴空出击',
			summary: '在淡蓝天空里躲开弹雨，打完一波还有下一波。',
			category: '飞行',
			tags: ['战机', '无尽'],
			status: 'playable',
			playCta: '开始出击'
		});
		expect(getGame('corner-florist')).toBeUndefined();
		expect(getGame('night-puzzle')).toBeUndefined();
		expect(aliasTarget('corner-florist')).toBe('window-garden');
		expect(aliasTarget('night-puzzle')).toBe('sky-sortie');
		expect(featuredGame()?.id).toBe('convenient-store');
		expect(GAME_CATEGORIES).toContain('飞行');
	});

	it('keeps 潮汐呼吸, 云上散步, and 记忆货架 playable', () => {
		const coming = GAMES.filter((game) => game.status === 'coming');
		expect(coming).toHaveLength(0);
		expect(getGame('tide-breath')).toMatchObject({
			title: '潮汐呼吸',
			englishTitle: 'Tide Breath',
			status: 'playable',
			playCta: '开始入海',
			category: '节奏'
		});
		expect(getGame('cloud-walk')).toMatchObject({
			title: '云上散步',
			englishTitle: 'Cloud Walk',
			status: 'playable',
			playCta: '开始散步',
			category: '休闲'
		});
		expect(getGame('memory-shelf')).toMatchObject({
			title: '记忆货架',
			englishTitle: 'Memory Shelf',
			status: 'playable',
			playCta: '开始整理',
			category: '益智'
		});
		expect(
			GAMES.every((game) => game.id && game.summary && game.tags.length > 0 && game.playCta)
		).toBe(true);
	});
});

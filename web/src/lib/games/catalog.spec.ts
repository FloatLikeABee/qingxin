import { describe, expect, it } from 'vitest';
import { aliasTarget, featuredGame, GAMES, GAME_CATEGORIES, getGame } from './catalog';

describe('games registry', () => {
	it('lists three playable games including 窗前庭园 and 晴空出击', () => {
		const playable = GAMES.filter((game) => game.status === 'playable');
		expect(playable.map((game) => game.id).sort()).toEqual(
			['convenient-store', 'sky-sortie', 'window-garden'].sort()
		);
		expect(getGame('convenient-store')).toMatchObject({
			title: '便利店经理',
			playCta: '开始经营',
			featured: true
		});
		expect(getGame('window-garden')).toMatchObject({
			title: '窗前庭园',
			summary: '把六十多种植物养熟，认出益虫和害虫。园子没有通关。',
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

	it('keeps the remaining 即将到来 slots', () => {
		const coming = GAMES.filter((game) => game.status === 'coming');
		expect(coming.map((game) => game.id)).toEqual(['tide-breath', 'cloud-walk', 'memory-shelf']);
		expect(
			GAMES.every((game) => game.id && game.summary && game.tags.length > 0 && game.playCta)
		).toBe(true);
	});
});

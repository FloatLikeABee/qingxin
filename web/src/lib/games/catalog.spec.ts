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

	it('lists playable games including 窗前庭园, 晴空出击, 潮汐呼吸, 云上散步, 记忆货架, 重卡, and 上班', () => {
		const playable = GAMES.filter((game) => game.status === 'playable');
		expect(playable.map((game) => game.id).sort()).toEqual(
			[
				'annual-report',
				'cargo-haul',
				'cloud-walk',
				'convenient-store',
				'home-kitchen',
				'memory-shelf',
				'operation',
				'shangban',
				'story-clinic',
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
		expect(GAME_CATEGORIES).toContain('驾驶');
		expect(getGame('cargo-haul')).toMatchObject({
			title: '重卡',
			englishTitle: 'Heavy Haul',
			category: '驾驶',
			tags: ['卡车', '公路', '无尽'],
			status: 'playable',
			playCta: '开始开车'
		});
		expect(playHref(getGame('cargo-haul')!)).toBe('/modules/games/cargo-haul/play');
	});

	it('keeps 潮汐呼吸, 云上散步, and 记忆货架 playable', () => {
		const coming = GAMES.filter((game) => game.status === 'coming');
		expect(coming).toHaveLength(0);
		expect(getGame('tide-breath')).toMatchObject({
			title: '潮汐呼吸',
			englishTitle: 'Tide Breath',
			status: 'playable',
			playCta: '开始入海',
			category: '节奏',
			summary: '夜海里按住升起、松开送浪，引发光的海物去捡海光。',
			cover: {
				sky: '#7DD3FC',
				ground: '#14B8A6',
				accent: '#EAB308',
				motif: 'wave'
			}
		});
		expect(getGame('tide-breath')?.about).toMatch(/海光/);
		expect(getGame('tide-breath')?.tags).toEqual(['呼吸', '海', '海光']);
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
			category: '益智',
			tags: ['书房', '书柜', '闹鬼']
		});
		expect(getGame('memory-shelf')?.summary).toMatch(/闹鬼|四只鬼/);
		expect(getGame('memory-shelf')?.about).toMatch(/对不起！/);
		expect(getGame('memory-shelf')?.about).toMatch(/没有计时，也没有分数/);
		expect(getGame('memory-shelf')?.about).toMatch(/最多四只鬼/);
		expect(getGame('memory-shelf')?.about).not.toMatch(/每轮只有一本/);
		expect(getGame('memory-shelf')?.about).not.toMatch(/布帘|收藏室/);
		expect(getGame('cargo-haul')).toMatchObject({
			title: '重卡',
			playCta: '开始开车',
			category: '驾驶'
		});
		expect(getGame('cargo-haul')?.about).toMatch(/倒车|回收/);
		expect(getGame('annual-report')).toMatchObject({
			title: '年报',
			englishTitle: 'Annual Report',
			category: '经营',
			tags: ['表格', '虚构', '财务'],
			status: 'playable',
			playCta: '打开年报'
		});
		expect(getGame('annual-report')?.about).toMatch(/不是真实财报/);
		expect(getGame('annual-report')?.about).toMatch(/SUM AVERAGE MIN MAX IF ROUND ABS/);
		expect(getGame('annual-report')?.about).toMatch(/200 行/);
		expect(getGame('annual-report')?.about).toMatch(/没有 XLOOKUP/);
		expect(playHref(getGame('annual-report')!)).toBe('/modules/games/annual-report/play');
		expect(getGame('operation')).toMatchObject({
			title: '手术',
			englishTitle: 'Operation',
			category: '益智',
			tags: ['手术', '器械', '止血'],
			status: 'playable',
			playCta: '进入手术台',
			cover: { motif: 'orlamp' }
		});
		expect(getGame('operation')?.about).toMatch(/写实手术画面/);
		expect(getGame('operation')?.about).toMatch(/不是医学训练/);
		expect(getGame('operation')?.about).toMatch(/切开/);
		expect(getGame('operation')?.about).toMatch(/缝合/);
		expect(getGame('operation')?.about).not.toMatch(/准备、显露/);
		expect(getGame('operation')?.about).not.toMatch(/止血\/冲洗/);
		expect(getGame('operation')?.about).not.toMatch(/器械清单/);
		expect(getGame('operation')?.about).not.toMatch(/伤口喷溅封面/);
		expect(playHref(getGame('operation')!)).toBe('/modules/games/operation/play');
		expect(getGame('home-kitchen')).toMatchObject({
			title: '烹饪',
			englishTitle: 'Cooking',
			category: '经营',
			tags: ['厨房', '炒菜', '烹饪'],
			status: 'playable',
			playCta: '开始做饭',
			cover: { motif: 'wok' }
		});
		expect(getGame('home-kitchen')?.title).not.toBe('灶台');
		expect(getGame('home-kitchen')?.about).toMatch(/没有客人/);
		expect(getGame('home-kitchen')?.about).toMatch(/倒计时/);
		expect(playHref(getGame('home-kitchen')!)).toBe('/modules/games/home-kitchen/play');
		expect(getGame('story-clinic')).toMatchObject({
			title: '中医馆',
			englishTitle: 'Hospital',
			category: '益智',
			tags: ['医院', '中医', '处方', '虚构'],
			status: 'playable',
			playCta: '开始接诊',
			cover: { motif: 'clinic' }
		});
		expect(getGame('story-clinic')?.title).not.toBe('医馆');
		expect(getGame('story-clinic')?.summary).toMatch(/医院/);
		expect(getGame('story-clinic')?.summary).toMatch(/虚构/);
		expect(getGame('story-clinic')?.about).toMatch(/药包/);
		expect(getGame('story-clinic')?.about).toMatch(/不是诊疗/);
		expect(getGame('story-clinic')?.about).not.toMatch(/疗效|主治|治愈|mg/);
		expect(playHref(getGame('story-clinic')!)).toBe('/modules/games/story-clinic/play');
		expect(
			GAMES.every((game) => game.id && game.summary && game.tags.length > 0 && game.playCta)
		).toBe(true);
	});
});

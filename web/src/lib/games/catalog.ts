export const GAME_CATEGORIES = ['全部', '经营', '休闲', '益智', '节奏', '飞行'] as const;

export type GameCategory = Exclude<(typeof GAME_CATEGORIES)[number], '全部'>;
export type GameStatus = 'playable' | 'coming';
export type CoverMotif = 'store' | 'garden' | 'jet' | 'wave' | 'cloud' | 'shelf';

export const GAME_ALIASES: Record<string, string> = {
	'corner-florist': 'window-garden',
	'night-puzzle': 'sky-sortie'
};

export function aliasTarget(id: string): string | undefined {
	return GAME_ALIASES[id];
}

export interface GameCoverArt {
	sky: string;
	ground: string;
	accent: string;
	motif: CoverMotif;
}

export interface GameInfo {
	id: string;
	title: string;
	englishTitle?: string;
	summary: string;
	about: string;
	category: GameCategory;
	tags: string[];
	status: GameStatus;
	featured?: boolean;
	playCta: string;
	cover: GameCoverArt;
}

export const GAMES: GameInfo[] = [
	{
		id: 'convenient-store',
		title: '便利店经理',
		englishTitle: 'Convenient Store Manager',
		summary: '进货、补货、看队伍。一个班次，把小店撑过去。',
		about:
			'你管一间街角便利店。客人进门、在货架前犹豫、去收银台排队。货空了他们会走；等太久他们也会走。从库房补上货架，钱够就再进一箱。班次结束看营收、剩货和客人满不满意。',
		category: '经营',
		tags: ['补货', '班次', '三维'],
		status: 'playable',
		playCta: '开始经营',
		featured: true,
		cover: {
			sky: '#9EC9FF',
			ground: '#F4E7D0',
			accent: '#3B82F6',
			motif: 'store'
		}
	},
	{
		id: 'window-garden',
		title: '窗前庭园',
		englishTitle: 'Window Garden',
		summary: '把六十多种植物养熟，认出益虫和害虫。园子没有通关。',
		about:
			'窗台上十二盆土。番茄、薄荷、银杏、牵牛……每一种叶子和花果都不一样，喝水、见光、吃肥也不一样。看清虫子：蜜蜂、蝴蝶和瓢虫请留着，蚜虫、毛虫和蜗牛要捉走。修剪和换盆会改长势。收成换成种子和照料用品。园子没有通关，只有下一季。这是简化的玩法，不是园艺教科书。',
		category: '经营',
		tags: ['种植', '虫鸣'],
		status: 'playable',
		playCta: '开始种植',
		cover: {
			sky: '#9EC9FF',
			ground: '#E7F6F1',
			accent: '#14B8A6',
			motif: 'garden'
		}
	},
	{
		id: 'sky-sortie',
		title: '晴空出击',
		englishTitle: 'Azure Sortie',
		summary: '在淡蓝天空里躲开弹雨，打完一波还有下一波。',
		about:
			'战机自己开火。键盘或手指带着它飞。三条命，挨打后会闪一会儿。侦察机、战斗机、轰炸机分值不同，残骸要躲开。每隔几波会来一架有预兆的头目。活着就有敌人。分数记在这台机器上。',
		category: '飞行',
		tags: ['战机', '无尽'],
		status: 'playable',
		playCta: '开始出击',
		cover: {
			sky: '#9EC9FF',
			ground: '#DBEAFE',
			accent: '#3B82F6',
			motif: 'jet'
		}
	},
	{
		id: 'tide-breath',
		title: '潮汐呼吸',
		summary: '跟着海面一起起落，把呼吸放慢。',
		about: '节奏还没写进拍号。先占一个位置。',
		category: '节奏',
		tags: ['呼吸', '海'],
		status: 'coming',
		playCta: '即将到来',
		cover: {
			sky: '#7DD3FC',
			ground: '#14B8A6',
			accent: '#EAB308',
			motif: 'wave'
		}
	},
	{
		id: 'cloud-walk',
		title: '云上散步',
		summary: '没有任务。沿一条淡路走走停停。',
		about: '休闲散步，路还没铺完。',
		category: '休闲',
		tags: ['散步', '云'],
		status: 'coming',
		playCta: '即将到来',
		cover: {
			sky: '#DBEAFE',
			ground: '#F8FAFC',
			accent: '#60A5FA',
			motif: 'cloud'
		}
	},
	{
		id: 'memory-shelf',
		title: '记忆货架',
		summary: '货架闪一下，凭记忆把缺的补上。',
		about: '益智补货，规则还在写。',
		category: '益智',
		tags: ['记忆', '货架'],
		status: 'coming',
		playCta: '即将到来',
		cover: {
			sky: '#FEF3C7',
			ground: '#F1E6D0',
			accent: '#EAB308',
			motif: 'shelf'
		}
	}
];

export function getGame(id: string): GameInfo | undefined {
	return GAMES.find((game) => game.id === id);
}

export function featuredGame(): GameInfo | undefined {
	return GAMES.find((game) => game.featured) ?? GAMES.find((game) => game.status === 'playable');
}

export function gameHref(game: GameInfo): string {
	return `/modules/games/${game.id}`;
}

export function playHref(game: GameInfo): string {
	return `/modules/games/${game.id}/play`;
}

export const GAME_CATEGORIES = ['全部', '经营', '休闲', '益智', '节奏'] as const;

export type GameCategory = Exclude<(typeof GAME_CATEGORIES)[number], '全部'>;
export type GameStatus = 'playable' | 'coming';
export type CoverMotif = 'store' | 'flowers' | 'puzzle' | 'wave' | 'cloud' | 'shelf';

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
		featured: true,
		cover: {
			sky: '#9EC9FF',
			ground: '#F4E7D0',
			accent: '#3B82F6',
			motif: 'store'
		}
	},
	{
		id: 'corner-florist',
		title: '街角花店',
		summary: '把当天的花束配齐，等有人推门进来。',
		about: '一间向阳的花店。之后会做成经营班次，这一期只把铺面留在目录里。',
		category: '经营',
		tags: ['花束', '橱窗'],
		status: 'coming',
		cover: {
			sky: '#F8C9C0',
			ground: '#E7F6F1',
			accent: '#F97316',
			motif: 'flowers'
		}
	},
	{
		id: 'night-puzzle',
		title: '夜窗拼图',
		summary: '把窗外那块被风吹乱的夜色拼回去。',
		about: '安静的益智。拼块还在打磨。',
		category: '益智',
		tags: ['夜晚', '拼块'],
		status: 'coming',
		cover: {
			sky: '#1E3A5F',
			ground: '#0B1526',
			accent: '#60A5FA',
			motif: 'puzzle'
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

export const GAME_CATEGORIES = ['全部', '经营', '休闲', '益智', '节奏', '飞行'] as const;

export type GameCategory = Exclude<(typeof GAME_CATEGORIES)[number], '全部'>;
export type GameStatus = 'playable' | 'coming';
export type CoverMotif = 'store' | 'garden' | 'jet' | 'wave' | 'cloud' | 'shelf' | 'office';

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
		summary: '种十种常见蔬菜，认出益虫和害虫。园子没有通关。',
		about:
			'窗台上十二盆土。番茄、黄瓜、茄子、辣椒、胡萝卜、萝卜、白菜、生菜、菠菜、小葱，开局都能种。点花盆照料，渴了浇水，饿了施肥。蜜蜂、蝴蝶和瓢虫请留着，蚜虫、毛虫和蜗牛要捉走。收成换成种子和照料用品。园子没有通关，只有下一季。这是简化的玩法，不是园艺教科书。',
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
		englishTitle: 'Tide Breath',
		summary: '夜海里按住升起、松开送浪，引发光的海物去捡海光。',
		about:
			'一片会呼吸的夜海。按住，潮面升起；松开，发光的波纹送出去。点海面或用方向键引导水母、灯鱼和蝠鲼去捡散落的海光，海光会唤醒海底的珊瑚园。没有计时，也不必憋气。这是一则海的散步，不是呼吸治疗。',
		category: '节奏',
		tags: ['呼吸', '海', '海光'],
		status: 'playable',
		playCta: '开始入海',
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
		englishTitle: 'Cloud Walk',
		summary: '在浮岛间散步、乘风、踩云，收集天气碎片，养成自己的云圃。',
		about:
			'一片很大的天空。走上浮岛，风会把你送到下一座岛，踩到云会弹起来。四处走走会遇见小云物。捡到阳光、雨丝、微风和夜色碎片，天色会跟着变，家里的云圃也会长出一株。没有计时，也没有分数。这是一则在云上的散步。',
		category: '休闲',
		tags: ['散步', '云', '天气'],
		status: 'playable',
		playCta: '开始散步',
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
		englishTitle: 'Memory Shelf',
		summary: '拿起物件端详，记住货架的改动，解开更绕的架子，再布置自己的收藏室。',
		about:
			'一间温暖的魔法书房。货架上的地球仪、茶杯、蛾标本都可以拿起来转着看。看清楚以后，布帘落下，东西会换位置。凭记忆把它们放回去。架子会越来越绕，解开的物件可以拿到收藏室里自由摆放。没有计时，也没有分数。放错了再拿起来就好。',
		category: '益智',
		tags: ['记忆', '货架', '书房'],
		status: 'playable',
		playCta: '开始整理',
		cover: {
			sky: '#FEF3C7',
			ground: '#F1E6D0',
			accent: '#EAB308',
			motif: 'shelf'
		}
	},
	{
		id: 'shangban',
		title: '上班',
		englishTitle: 'Workday',
		summary: '走进五层大厦，自己选岗位，做分拣、谈判、维修和经营决定。',
		about:
			'你走进轻心大厦。自己选岗位，走路、坐电梯、在工位上把当天的活做完。班次还在本机继续，进度记在原来的存档里。玩法和以前一样，只是从游戏目录进。',
		category: '经营',
		tags: ['工位', '大厦', '班次'],
		status: 'playable',
		playCta: '开始上班',
		cover: {
			sky: '#9EC9FF',
			ground: '#E2E8F0',
			accent: '#3B82F6',
			motif: 'office'
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

export const GAME_CATEGORIES = ['全部', '经营', '休闲', '益智', '节奏', '飞行', '驾驶'] as const;

export type GameCategory = Exclude<(typeof GAME_CATEGORIES)[number], '全部'>;
export type GameStatus = 'playable' | 'coming';
export type CoverMotif =
	| 'store'
	| 'garden'
	| 'jet'
	| 'wave'
	| 'cloud'
	| 'shelf'
	| 'office'
	| 'truck'
	| 'ledger'
	| 'orlamp'
	| 'wok'
	| 'clinic';

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
		id: 'home-kitchen',
		title: '烹饪',
		englishTitle: 'Cooking',
		summary: '在自家厨房把菜叶、肉片、蛋、面团、豆腐和虾炒熟，再盛盘。没有订单，也不赶时间。',
		about:
			'这是一间家里的厨房。碗里是生菜叶、肉片、蛋、面团、豆腐和虾。拖进锅里，文火或武火，在锅里搅一搅。食材会从生变熟、出一点蒸汽。炒好了盛到盘子上，名字只是口味，不是通关。锅最多十二份，盘子最多八盘；满了会轻轻说一声，不是失败。没有客人，没有倒计时。锅气要你自己打开。',
		category: '经营',
		tags: ['厨房', '炒菜', '烹饪'],
		status: 'playable',
		playCta: '开始做饭',
		cover: {
			sky: '#F8E0B8',
			ground: '#C47A3A',
			accent: '#E36B2A',
			motif: 'wok'
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
		id: 'cargo-haul',
		title: '重卡',
		englishTitle: 'Heavy Haul',
		summary: '开着大货车在公路、城市和乡间路上一直开下去。',
		about:
			'宽路、真转向。方向盘打弯、油门刹车倒车都算。公路接到城市接到田野，路段会回收所以开很久也不会把内存撑爆。轧出路面会刮底板，卡住了就回收到上一条路面，里程还在。没有通关，也不逼你赶路。',
		category: '驾驶',
		tags: ['卡车', '公路', '无尽'],
		status: 'playable',
		playCta: '开始开车',
		cover: {
			sky: '#F4C38A',
			ground: '#8FA98A',
			accent: '#3B82F6',
			motif: 'truck'
		}
	},
	{
		id: 'annual-report',
		title: '年报',
		englishTitle: 'Annual Report',
		summary: '打开一本虚构公司的年报，改假设，三张报表一起算。',
		about:
			'本表是游戏里的虚构公司数据，不是真实财报，也不连接 Excel。青柠示意有限公司（示意代码 QX-SHOW-0001，不是真的 ISIN）有假设、利润表、资产负债表、现金流量表。改增长率和费用率，公式会跨表重算。支持加减乘除、括号、比较、A1、$A$1、跨表引用，以及 SUM AVERAGE MIN MAX IF ROUND ABS。每张表最多 200 行、26 列；撤销约 50 步只在这本打开的表里。没有 XLOOKUP、透视、VBA，也没有 xlsx。这不是 Microsoft Excel。',
		category: '经营',
		tags: ['表格', '虚构', '财务'],
		status: 'playable',
		playCta: '打开年报',
		cover: {
			sky: '#F8E6C8',
			ground: '#E8D5B5',
			accent: '#3B82F6',
			motif: 'ledger'
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
		summary: '化作游魂在连成一片的云界飞升、潜入，可选地捡天气碎片养云圃。',
		about:
			'一片连起来的云界。化作半透明的游魂，对着镜头飞，按住飞升或潜入。可以进云圃、异星台地、倒置的城，也可以从井口潜到水下的潜界。天气碎片仍会改天色、长云圃，但没有门、没有任务、没有计时。这是一则在云上的散步。',
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
		summary: '整理一柜更满的旧书。最多四只鬼会同时钻出来道歉，再钻回同一本书。',
		about:
			'一间温暖的书房，一整面胡桃木书柜摆满旧书、地球仪、茶杯和蛾标本。拿起来、换个格子、随便摆。最多四只鬼会同时从各自的书里钻出来、挤出一张脸、掉夸张的眼泪，然后说「对不起！」，再羞答答钻回同一本书。没有计时，也没有分数。不是跳吓，也没有追逐。',
		category: '益智',
		tags: ['书房', '书柜', '闹鬼'],
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
	},
	{
		id: 'story-clinic',
		title: '中医馆',
		englishTitle: 'Hospital',
		summary: '在一间虚构的医院里听故事、写纸条、抓药包。不是诊疗。',
		about:
			'这是一间故事里的中医馆，也是游戏里的医院。候诊厅坐着会说话的狐狸、书记员、石龟和风筝，都不是真人。听完它们的牢骚，望一望、闻一闻、把把脉，会看到故事标签。写一张不超过八十个字的纸条，从柜子里选二到五只罐子，数量是游戏药包，不是克或医嘱。抓药之后它们会带着笑话回来。对上两三个标签就暖和些，对上一两个就客气追问，对不上也只是笑料，它们本来就没事。虚构娱乐，不是诊疗，没有真实剂量，不能当医嘱。',
		category: '益智',
		tags: ['医院', '中医', '处方', '虚构'],
		status: 'playable',
		playCta: '开始接诊',
		cover: {
			sky: '#F4E4C8',
			ground: '#6B3A22',
			accent: '#C4A35A',
			motif: 'clinic'
		}
	},
	{
		id: 'operation',
		title: '手术',
		englishTitle: 'Operation',
		summary: '在四个虚构解剖区域里切开、缝合。写实画面含血液，不是医学训练。',
		about:
			'内容警告：本游戏含写实手术画面、伤口与血液，仅供娱乐。这不是医学训练，也不能用于真实诊疗。数据与解剖均为虚构。先阅读警告并点「我已知晓，进入手术」，再从身体图选择前臂、膝、口腔或腹。其他部位显示未开放，并不是全身解剖。用刀和缝针沿标记线切开、缝合。目录封面只有灯和铺单，没有伤口。',
		category: '益智',
		tags: ['手术', '器械', '止血'],
		status: 'playable',
		playCta: '进入手术台',
		cover: {
			sky: '#D7EEE4',
			ground: '#1F6B4A',
			accent: '#F4E27A',
			motif: 'orlamp'
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

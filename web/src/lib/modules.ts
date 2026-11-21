export interface ModuleInfo {
	slug: string;
	name: string;
	summary: string;
	accent: string;
	icon: string;
}

export const MODULES: ModuleInfo[] = [
	{
		slug: 'secrets',
		name: '秘密',
		summary: '把不想公开的话写成一封信，信箱会回一封信，而不是聊天。',
		accent: '#C45C6A',
		icon: 'envelope'
	},
	{
		slug: 'mood',
		name: '情绪日记+冥想',
		summary: '记录心情起伏，用短冥想把呼吸放慢。',
		accent: '#60A5FA',
		icon: 'cloud'
	},
	{
		slug: 'finance',
		name: '个人财务小助手',
		summary: '账单与预算一目了然，只做记账工具。',
		accent: '#34D399',
		icon: 'wallet'
	},
	{
		slug: 'elder',
		name: '老人助手',
		summary: '用药提醒、大字号日程，给家人一份安心。',
		accent: '#F59E0B',
		icon: 'heart'
	},
	{
		slug: 'jimutai',
		name: '积木台',
		summary: '五块小积木，放到桌上拼在一起。没有输赢，拼完再给五块。',
		accent: '#60A5FA',
		icon: 'blocks'
	},
	{
		slug: 'pet',
		name: '宠物',
		summary: '喂食、疫苗与可爱日常，都放在同一本册子。',
		accent: '#FB7185',
		icon: 'paw'
	},
	{
		slug: 'health',
		name: '健康',
		summary: '睡眠、饮水与步数记录，不是诊断。',
		accent: '#2DD4BF',
		icon: 'pulse'
	},
	{
		slug: 'games',
		name: '游戏',
		summary: '逛目录。上班、便利店经理都可以从这里进。',
		accent: '#EAB308',
		icon: 'game'
	}
];

export function getModule(slug: string): ModuleInfo | undefined {
	return MODULES.find((item) => item.slug === slug);
}

export interface ModuleInfo {
	slug: string;
	name: string;
	summary: string;
	accent: string;
	icon: string;
}

export const MODULES: ModuleInfo[] = [
	{
		slug: 'create',
		name: '内容创作',
		summary: '写成可发出去的草稿，再用系统分享或复制发到小红书、微信、抖音。',
		accent: '#38BDF8',
		icon: 'pen'
	},
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
		slug: 'local',
		name: '本地生活',
		summary: '附近服务与社区信息，先看再决定。',
		accent: '#F472B6',
		icon: 'map'
	},
	{
		slug: 'ai',
		name: 'AI效率工具箱',
		summary: '草稿、摘要、对照检查，效率留给你自己。',
		accent: '#818CF8',
		icon: 'spark'
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
		slug: 'study',
		name: '学习打卡',
		summary: '专注一块、打卡一天，看见自己的连续。',
		accent: '#A78BFA',
		icon: 'book'
	},
	{
		slug: 'hustle',
		name: '求职副业',
		summary: '机会清单与进度板，信息展示，不是职场咨询。',
		accent: '#FBBF24',
		icon: 'briefcase'
	},
	{
		slug: 'games',
		name: '游戏',
		summary: '逛目录，进小店。先从便利店经理开始。',
		accent: '#EAB308',
		icon: 'game'
	}
];

export function getModule(slug: string): ModuleInfo | undefined {
	return MODULES.find((item) => item.slug === slug);
}

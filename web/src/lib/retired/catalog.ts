export interface RetiredModule {
	slug: 'local' | 'ai' | 'study' | 'hustle';
	name: string;
	aliases: string[];
	blurb: string;
}

export const RETIRED_MODULES: RetiredModule[] = [
	{
		slug: 'local',
		name: '本地生活',
		aliases: ['/modules/local'],
		blurb: '附近服务的地图不再从轻心打开。你设备上的旧记录还在，没有删除。'
	},
	{
		slug: 'ai',
		name: 'AI效率工具箱',
		aliases: ['/modules/ai'],
		blurb: '工具箱不再从轻心打开。历史结果还在设备上，没有删除。'
	},
	{
		slug: 'study',
		name: '学习打卡',
		aliases: ['/modules/study', '/study'],
		blurb: '打卡、错题和笔记不再从轻心打开。你写下的内容还在设备上，没有删除。'
	},
	{
		slug: 'hustle',
		name: '求职副业',
		aliases: ['/modules/hustle'],
		blurb: '投递看板和简历不再从轻心打开。旧的投递记录还在设备上，没有删除。'
	}
];

export function retiredBySlug(slug: string): RetiredModule | undefined {
	return RETIRED_MODULES.find((item) => item.slug === slug);
}

export function isRetiredSlug(slug: string) {
	return Boolean(retiredBySlug(slug));
}

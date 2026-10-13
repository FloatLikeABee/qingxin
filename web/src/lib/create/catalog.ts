export const PLATFORMS = ['小红书', '公众号', '抖音', '周报'] as const;
export type CreatePlatform = (typeof PLATFORMS)[number];

export const TONES = ['更专业', '更幽默', '更精简'] as const;
export type CreateTone = (typeof TONES)[number];

export const LENGTHS = ['短', '中', '长'] as const;
export type CreateLength = (typeof LENGTHS)[number];

export const SNIPPET_KINDS = ['金句', '案例', '过渡'] as const;
export type SnippetKind = (typeof SNIPPET_KINDS)[number];

export interface CreateTemplate {
	id: string;
	platform: CreatePlatform;
	name: string;
	body: string;
}

export interface Inspiration {
	id: string;
	topic: string;
	platform: CreatePlatform;
	hook: string;
}

export interface OutlineSlide {
	heading: string;
	bullets: string[];
}

export interface CreateOutline {
	title: string;
	slides: OutlineSlide[];
	markdown?: string;
}

export const TEMPLATES: CreateTemplate[] = [
	{
		id: 'xhs-daily',
		platform: '小红书',
		name: '日常种草',
		body: '标题：{{主题}}\n封面要点：{{关键词}}\n正文用三句把体验写清楚，收在一句邀请。'
	},
	{
		id: 'mp-essay',
		platform: '公众号',
		name: '深度长文',
		body: '标题：{{主题}}\n导语点出{{关键词}}\n分三段：现象、方法、小结。'
	},
	{
		id: 'dy-script',
		platform: '抖音',
		name: '口播脚本',
		body: '钩子：{{主题}}\n口播 20 秒讲清{{关键词}}\n结尾给行动指令。'
	},
	{
		id: 'weekly-note',
		platform: '周报',
		name: '一周复盘',
		body: '主题：{{主题}}\n本周关键词：{{关键词}}\n成果 / 卡点 / 下周三件事。'
	}
];

export const INSPIRATION: Inspiration[] = [
	{ id: 'ins-1', topic: '阳台种菜', platform: '小红书', hook: '一块托盘也能长出夏天。' },
	{ id: 'ins-2', topic: '午睡十分钟', platform: '公众号', hook: '把午后还给自己。' },
	{ id: 'ins-3', topic: '通勤英语', platform: '抖音', hook: '一站路，一句新表达。' },
	{ id: 'ins-4', topic: '季度复盘', platform: '周报', hook: '把忙过的日子排成三列。' }
];

export function isCreatePlatform(value: string): value is CreatePlatform {
	return (PLATFORMS as readonly string[]).includes(value);
}

export function isCreateTone(value: string): value is CreateTone {
	return (TONES as readonly string[]).includes(value);
}

export function isSnippetKind(value: string): value is SnippetKind {
	return (SNIPPET_KINDS as readonly string[]).includes(value);
}

export function filterTemplates(
	templates: CreateTemplate[],
	platform?: CreatePlatform | ''
): CreateTemplate[] {
	if (!platform) return [...templates];
	return templates.filter((item) => item.platform === platform);
}

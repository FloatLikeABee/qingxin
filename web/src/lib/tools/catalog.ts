export const TOOL_IDS = [
	'summary',
	'meeting',
	'writing.weekly',
	'writing.daily',
	'writing.xhs',
	'polish',
	'resume_jd',
	'rename'
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

export type InputKind = 'text' | 'url' | 'pdf';
export type MeetingStep = 'topics' | 'decisions';
export type PolishTone = '更专业' | '更幽默' | '更精简';

export interface ToolItem {
	id: ToolId;
	name: string;
	blurb: string;
	favourite: boolean;
}

export const POLISH_TONES: PolishTone[] = ['更专业', '更幽默', '更精简'];

export const TOOLS: Omit<ToolItem, 'favourite'>[] = [
	{ id: 'summary', name: '摘要', blurb: '文本、链接或 PDF，抽出待办。' },
	{ id: 'meeting', name: '会议助手', blurb: '先议题，再决策。' },
	{ id: 'writing.weekly', name: '周报', blurb: '把一周进展写成可发出去的周报。' },
	{ id: 'writing.daily', name: '日报', blurb: '用几句把今天写清楚。' },
	{ id: 'writing.xhs', name: '小红书', blurb: '短笔记口吻，适合随手发。' },
	{ id: 'polish', name: '润色', blurb: '更专业、更幽默或更精简。' },
	{ id: 'resume_jd', name: '简历对照', blurb: '对照职位，标出重合与缺口。' },
	{ id: 'rename', name: '文件命名', blurb: '给一串乱文件名一个干净建议。' }
];

export function isToolId(value: string): value is ToolId {
	return (TOOL_IDS as readonly string[]).includes(value);
}

export function mergeCatalog(
	favourites: string[],
	recent: string[]
): { items: ToolItem[]; recent: ToolId[]; favourites: ToolId[] } {
	const favSet = new Set(favourites);
	const items = TOOLS.map((item) => ({ ...item, favourite: favSet.has(item.id) }));
	return {
		items,
		recent: recent.filter(isToolId),
		favourites: favourites.filter(isToolId)
	};
}

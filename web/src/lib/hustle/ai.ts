import type { HustleKind, SideHustle } from './catalog';

export const DISCLAIMER = '以上为示意文字，不构成求职、面试或副业咨询。';

export function mockOptimize(name: string, title: string): string {
	return `已整理「${name}」的简历要点：突出${title || '相关'}经历，把技能写成可验证成果。此为示意改写。`;
}

export function mockInterviewer(question: string): string {
	return `针对「${question}」：请先说结论，再补一个你做过的例子。此为示意追问。`;
}

function card(
	id: string,
	title: string,
	platform: string,
	estimatedIncome: number,
	skillsRequired: string[],
	kind: HustleKind,
	hoursPerWeek: number
): SideHustle {
	return { id, title, platform, estimatedIncome, skillsRequired, kind, hoursPerWeek };
}

export function mockSuggestions(skills: string[], hoursPerWeek: number): SideHustle[] {
	const ordered = [...skills].sort();
	const hours = Math.max(1, hoursPerWeek);
	const focus = ordered[0] ?? '综合技能';
	const skillCard = ordered.some((item) => item.includes('设计')) ? '模板与视觉小单' : '技能分享课';
	const third =
		hours >= 8
			? card('suggest-offline', '周末本地服务', '本地', 150 * hours, ordered, '线下', hours)
			: card('suggest-micro', '碎片时间问答', '线上社区', 80 * hours, ordered, '线上', hours);
	return [
		card(
			'suggest-online',
			`${focus}方向的线上接单`,
			'线上接单',
			200 * hours,
			ordered,
			'线上',
			hours
		),
		card('suggest-skill', skillCard, '技能型平台', 350 * hours, ordered, '技能型', hours),
		third
	].map((item, index) => ({ ...item, id: `${item.id}-${index}` }));
}

export function suggestionReason(item: SideHustle, hours: number): string {
	if (item.kind === '线下') return '时间较充裕时可以试一次线下。';
	if (item.kind === '技能型')
		return `结合${item.skillsRequired.join('、') || '现有技能'}做可复用交付。`;
	if (item.title.includes('问答')) return '时间不多时用问答换示意收入。';
	return `每周约${hours}小时，适合先从线上开始。`;
}

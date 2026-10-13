import type { CreateLength, CreateOutline, CreatePlatform, CreateTone } from './catalog';

export const DISCLAIMER = '以上为示意文字，不构成专业文案或营销建议。';

export function mockGenerate(input: {
	platform: CreatePlatform;
	topic: string;
	keywords: string[];
	tone: CreateTone;
	length: CreateLength;
}): string {
	const ordered = [...input.keywords]
		.map((item) => item.trim())
		.filter(Boolean)
		.sort();
	const joined = ordered.length ? ordered.join('、') : '日常';
	return `【${input.platform}·${input.tone}·${input.length}】${input.topic}：把${joined}写成可收藏的日常。此为示意文案。`;
}

export function mockTitles(topic: string): string[] {
	return [
		`${topic}，我记下的第一句`,
		`关于${topic}的十个小观察`,
		`${topic}｜不想写得很满`,
		`把${topic}说给明天的自己`,
		`${topic}其实很轻`,
		`一份${topic}备忘`,
		`${topic}：从一句开始`,
		`今晚只写${topic}`,
		`${topic}的安静版本`,
		`${topic}｜灵感10`
	];
}

export function mockPolish(text: string, tone: CreateTone): string {
	return `（${tone}）${text}。此为示意润色。`;
}

export function mockOutline(topic: string): CreateOutline {
	const slides = [
		{ heading: '封面', bullets: [topic, '示意大纲，可改标题'] },
		{ heading: '要点', bullets: ['发生了什么', '为什么值得写', '读者带走一句'] },
		{ heading: '下一步', bullets: ['选择一个平台发出', '记下要复用的金句'] }
	];
	const title = `${topic} · 示意大纲`;
	return {
		title,
		slides,
		markdown: outlineMarkdown(title, slides)
	};
}

export function outlineMarkdown(
	title: string,
	slides: { heading: string; bullets: string[] }[]
): string {
	let out = `# ${title}\n`;
	for (const slide of slides) {
		out += `\n## ${slide.heading}\n`;
		for (const bullet of slide.bullets) {
			out += `- ${bullet}\n`;
		}
	}
	return out;
}

import type { AiTask, ToolRunInput } from '../api/types';
import type { ToolId } from './catalog';

export const DISCLAIMER = '以上为示意结果，不构成专业建议。';

function todosFrom(text: string): { text: string; done: boolean }[] {
	const parts = text
		.split(/[、。；;\n，]/)
		.map((item) => item.replace(/^并/, '').trim())
		.filter((item) => item.length >= 2)
		.slice(0, 5);
	return (parts.length ? parts : ['整理要点']).map((item) => ({ text: item, done: false }));
}

function sanitizeFilename(name: string): string {
	const dot = name.lastIndexOf('.');
	const stem = dot > 0 ? name.slice(0, dot) : name;
	const ext = dot > 0 ? name.slice(dot) : '';
	const cleaned = stem.replace(/[^\w\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '');
	return `${cleaned || '文件'}${ext}`;
}

export function mockRun(
	toolId: ToolId,
	input: ToolRunInput
): Pick<AiTask, 'outputText' | 'outputJson'> {
	const text = (input.text ?? '').trim();
	switch (toolId) {
		case 'summary': {
			const summary = `【示意摘要】${text.slice(0, 80) || input.url || '材料'}。待办已列出。`;
			return {
				outputText: summary,
				outputJson: { summary, todos: todosFrom(text || '打开链接并记下待办') }
			};
		}
		case 'meeting': {
			const topics = text
				.split(/[。；;\n]/)
				.map((item) => item.trim())
				.filter((item) => item.length >= 2);
			const list = topics.length ? topics : ['待讨论事项'];
			if (input.step === 'decisions') {
				const decisions = list.map((topic) => `决定：${topic}`);
				return {
					outputText: `【会议决策】${decisions.join('；')}`,
					outputJson: { topics: list, decisions, step: 'decisions' }
				};
			}
			return {
				outputText: `【会议议题】${list.join('；')}`,
				outputJson: { topics: list, decisions: [], step: 'topics' }
			};
		}
		case 'writing.weekly':
			return {
				outputText: `【周报】${text}。此为示意文案。`,
				outputJson: { text: `【周报】${text}。此为示意文案。` }
			};
		case 'writing.daily':
			return {
				outputText: `【日报】${text}。此为示意文案。`,
				outputJson: { text: `【日报】${text}。此为示意文案。` }
			};
		case 'writing.xhs':
			return {
				outputText: `【小红书】${text}。此为示意文案。`,
				outputJson: { text: `【小红书】${text}。此为示意文案。` }
			};
		case 'polish': {
			const tone = input.tone ?? '更专业';
			const out = `（${tone}）${text}。此为示意润色。`;
			return { outputText: out, outputJson: { text: out } };
		}
		case 'resume_jd': {
			const score = 72;
			return {
				outputText: `【对照】匹配度 ${score}。此为示意，不构成职业建议。`,
				outputJson: {
					score,
					matches: ['相关经验'],
					gaps: ['补充量化结果'],
					advice: '把重合技能写进首段。'
				}
			};
		}
		case 'rename': {
			const filenames = input.filenames ?? [];
			const suggestions = filenames.map((original) => ({
				original,
				suggested: sanitizeFilename(original),
				reason: '去掉空格与序号，便于检索。'
			}));
			return {
				outputText: suggestions.map((item) => item.suggested).join('\n'),
				outputJson: { suggestions }
			};
		}
	}
}

export function chunkText(text: string, size = 8): string[] {
	const chunks: string[] = [];
	for (let i = 0; i < text.length; i += size) {
		chunks.push(text.slice(i, i + size));
	}
	return chunks.length ? chunks : [''];
}

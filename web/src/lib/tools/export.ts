import type { AiTask } from '../api/types';
import { TOOLS } from './catalog';

export function taskToMarkdown(task: AiTask): string {
	const name = TOOLS.find((item) => item.id === task.toolId)?.name ?? task.toolId;
	return [
		`# ${name}`,
		`时间：${task.createdAt}`,
		'',
		'## 输入',
		task.inputText,
		'',
		'## 输出',
		task.outputText,
		'',
		task.disclaimer
	].join('\n');
}

export function downloadText(filename: string, text: string) {
	const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

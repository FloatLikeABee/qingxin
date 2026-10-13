export const EDITOR_CLASS = 'create-editor';

export const EDITOR_COLORS = {
	background: '#0F172A',
	text: '#E2E8F0',
	variable: '#38BDF8'
} as const;

export type HighlightPart = { text: string; kind: 'plain' | 'variable' };

export function highlightVariables(text: string): HighlightPart[] {
	const parts: HighlightPart[] = [];
	const pattern = /\{\{[^}]+\}\}/g;
	let last = 0;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(text))) {
		if (match.index > last) {
			parts.push({ text: text.slice(last, match.index), kind: 'plain' });
		}
		parts.push({ text: match[0], kind: 'variable' });
		last = match.index + match[0].length;
	}
	if (last < text.length) {
		parts.push({ text: text.slice(last), kind: 'plain' });
	}
	return parts;
}

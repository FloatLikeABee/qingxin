export const DISCLAIMER = '以上为示意陪伴文字，不构成医疗建议、诊断或治疗。';

export function mockInsight(emoji: string, tags: string[]): string {
	const ordered = [...tags].sort();
	const low = ['😔', '😢', '😡', '😰'].includes(emoji);
	const high = ['😄', '🙂', '🥰'].includes(emoji);
	const tone = low
		? '今天有些沉重。先允许自己慢一点，比责怪自己更有用。'
		: high
			? '这份轻松值得被看见。把它轻轻放进今天即可。'
			: '这一笔很平静。把呼吸放慢一点，就已经在照顾自己。';
	const extra = ordered.includes('睡眠')
		? '睡眠不足时，情绪会先说话。'
		: ordered.includes('工作')
			? '工作可以告一段落，人不需要一直在线。'
			: '你已经写下了这一刻，这就够了。';
	return `${tone}${extra}`;
}

export function chunkInsight(text: string, size = 2, reducedMotion = false): string[] {
	if (reducedMotion || text.length === 0) return [text];
	const chunks: string[] = [];
	for (let i = size; i < text.length; i += size) {
		chunks.push(text.slice(0, i));
	}
	chunks.push(text);
	return chunks;
}

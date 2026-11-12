export const SHARE_TARGETS = ['小红书', '微信', '抖音', '公众号'] as const;
export type ShareTarget = (typeof SHARE_TARGETS)[number];

export interface ShareDraft {
	title: string;
	body: string;
	tags?: string[];
}

export interface SharePack {
	title: string;
	text: string;
}

export type ShareMethod = 'web-share' | 'clipboard' | 'cancelled';

function tagLine(tags: string[] | undefined): string {
	return (tags ?? [])
		.map((tag) => tag.trim())
		.filter(Boolean)
		.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
		.join(' ');
}

export function formatSharePack(target: ShareTarget, draft: ShareDraft): SharePack {
	const title = draft.title.trim();
	const body = draft.body.trim();
	const tags = tagLine(draft.tags);
	if (target === '小红书') {
		return { title, text: [title, body, tags].filter(Boolean).join('\n\n') };
	}
	if (target === '抖音') {
		return { title, text: [body || title, tags].filter(Boolean).join('\n') };
	}
	if (target === '公众号') {
		return { title, text: `# ${title}\n\n${body}`.trim() };
	}
	return { title, text: [title, body].filter(Boolean).join('\n\n') };
}

export interface ShareBridge {
	share?: (data: ShareData) => Promise<void>;
	clipboard?: { writeText: (text: string) => Promise<void> };
}

export async function shareViaOfficial(
	pack: SharePack,
	api: ShareBridge = typeof navigator === 'undefined' ? {} : navigator
): Promise<{ method: ShareMethod }> {
	if (typeof api.share === 'function') {
		try {
			await api.share({ title: pack.title, text: pack.text });
			return { method: 'web-share' };
		} catch (error) {
			if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
				return { method: 'cancelled' };
			}
		}
	}
	const writeText = api.clipboard?.writeText;
	if (!writeText) {
		throw new Error('当前浏览器无法分享或复制');
	}
	await writeText(pack.text);
	return { method: 'clipboard' };
}

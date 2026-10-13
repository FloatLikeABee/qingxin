import { MOOD_EMOJIS, MOOD_TAGS, type MoodTag } from './catalog';

export interface CheckInInput {
	emoji: string;
	tags: string[];
	note?: string;
}

export interface CheckInValue {
	emoji: string;
	score: number;
	tags: MoodTag[];
	note: string | null;
}

export type CheckInResult =
	| { ok: true; value: CheckInValue }
	| { ok: false; code: 'invalid_request'; message: string };

export function validateCheckIn(input: CheckInInput): CheckInResult {
	const face = MOOD_EMOJIS.find((item) => item.glyph === input.emoji);
	if (!face) {
		return { ok: false, code: 'invalid_request', message: '请选择一个心情表情' };
	}
	const tags: MoodTag[] = [];
	for (const tag of input.tags) {
		if (!(MOOD_TAGS as readonly string[]).includes(tag)) {
			return { ok: false, code: 'invalid_request', message: `未知标签：${tag}` };
		}
		if (!tags.includes(tag as MoodTag)) tags.push(tag as MoodTag);
	}
	const trimmed = input.note?.trim() ?? '';
	if ([...trimmed].length >= 100) {
		return { ok: false, code: 'invalid_request', message: '备注请少于 100 字' };
	}
	return {
		ok: true,
		value: {
			emoji: face.glyph,
			score: face.score,
			tags,
			note: trimmed.length === 0 ? null : trimmed
		}
	};
}

import {
	CATEGORIES,
	CORRECTION_KINDS,
	ELDER_TAGS,
	type CorrectionKind,
	type LocalCategory
} from './catalog';

export type Checked<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

export interface PublishInput {
	name: string;
	category: string;
	address: string;
	latitude: number;
	longitude: number;
	hours?: string;
	phone?: string;
	tags?: string[];
}

export interface ReviewInput {
	content: string;
	rating?: number;
}

export function validatePublish(
	input: PublishInput
): Checked<PublishInput & { category: LocalCategory; tags: string[] }> {
	const name = input.name.trim();
	const address = input.address.trim();
	if (!name) return { ok: false, code: 'invalid_request', message: '请填写店名' };
	if (!address) return { ok: false, code: 'invalid_request', message: '请填写地址' };
	if (!CATEGORIES.includes(input.category as LocalCategory)) {
		return { ok: false, code: 'invalid_request', message: '请选择分类' };
	}
	const tags = input.tags ?? [];
	if (tags.some((tag) => !ELDER_TAGS.includes(tag as (typeof ELDER_TAGS)[number]))) {
		return { ok: false, code: 'invalid_request', message: '标签不在适老清单里' };
	}
	if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
		return { ok: false, code: 'invalid_request', message: '请填写坐标' };
	}
	return {
		ok: true,
		value: {
			...input,
			name,
			address,
			category: input.category as LocalCategory,
			tags
		}
	};
}

export function validateReview(input: ReviewInput): Checked<ReviewInput> {
	const content = input.content.trim();
	if (!content) return { ok: false, code: 'invalid_request', message: '请写下评价' };
	if ([...content].length > 500) {
		return { ok: false, code: 'invalid_request', message: '评价请控制在 500 字以内' };
	}
	if (input.rating != null && (input.rating < 1 || input.rating > 5)) {
		return { ok: false, code: 'invalid_request', message: '评分需要 1 到 5' };
	}
	return { ok: true, value: { ...input, content } };
}

export function validateCorrection(kind: string): Checked<CorrectionKind> {
	if (!CORRECTION_KINDS.includes(kind as CorrectionKind)) {
		return { ok: false, code: 'invalid_request', message: '请选择纠错类型' };
	}
	return { ok: true, value: kind as CorrectionKind };
}

import { describe, expect, it } from 'vitest';
import {
	petLogWriteBody,
	petRecordWriteBody,
	petWeightWriteBody,
	petWriteBody
} from '../pets/http';
import {
	studyChallengeWriteBody,
	studyCheckinWriteBody,
	studyFlashcardWriteBody,
	studyFromTemplateBody,
	studyNoteWriteBody,
	studyReviewWriteBody,
	studySkillWriteBody
} from '../study/http';
import { CAMEL_BAN, validateSchema } from './contract';

const writes: { schema: string; body: unknown }[] = [
	{
		schema: 'PetWrite',
		body: petWriteBody({
			name: '豆豆',
			species: 'cat',
			breed: '狸花',
			birthday: '2023-04-01',
			avatarUrl: 'https://cdn.example/doudou.png'
		})
	},
	{
		schema: 'PetRecordWrite',
		body: petRecordWriteBody({
			type: 'vaccine',
			date: '2026-10-13',
			nextDueDate: '2027-10-13',
			note: '第二针'
		})
	},
	{
		schema: 'PetWeightWrite',
		body: petWeightWriteBody({ measuredOn: '2026-10-13', weightG: 4200 })
	},
	{
		schema: 'PetLogWrite',
		body: petLogWriteBody({ type: 'feed', value: '早膳' })
	},
	{
		schema: 'StudyChallengeWrite',
		body: studyChallengeWriteBody({ name: '背单词', targetDays: 21, timezone: 'Asia/Shanghai' })
	},
	{
		schema: 'StudyCheckinWrite',
		body: studyCheckinWriteBody({ day: '2026-10-13' })
	},
	{
		schema: 'StudyFlashcardWrite',
		body: studyFlashcardWriteBody({ front: '过去分词', back: 'done', category: '语法' })
	},
	{
		schema: 'StudyReviewWrite',
		body: studyReviewWriteBody({ grade: 'good' })
	},
	{
		schema: 'StudyNoteWrite',
		body: studyNoteWriteBody({ title: '动词', contentMd: '笔记', tags: ['语法'] })
	},
	{
		schema: 'StudySkillWrite',
		body: studySkillWriteBody({ title: '词根', parentId: '11111111-1111-4111-8111-111111111111' })
	},
	{
		schema: 'StudyFromTemplate',
		body: studyFromTemplateBody({ templateId: 'english-vocab' })
	}
];

describe('OpenAPI contract for M6/M8 write bodies', () => {
	it.each(writes)('$schema validates against openapi.yaml', ({ schema, body }) => {
		expect(JSON.stringify(body), `${schema} leaked camelCase`).not.toMatch(CAMEL_BAN);
		const result = validateSchema(schema, body);
		expect(result.errors, result.errors).toBe('');
		expect(result.ok).toBe(true);
	});

	it('fails when an adapter would send avatarUrl instead of avatar_url', () => {
		const leaked = { name: '豆豆', species: 'cat', avatarUrl: 'https://cdn.example/doudou.png' };
		expect(JSON.stringify(leaked)).toMatch(/avatarUrl/);
		const mapped = petWriteBody({
			name: '豆豆',
			species: 'cat',
			avatarUrl: 'https://cdn.example/doudou.png'
		});
		expect(mapped).toEqual({
			name: '豆豆',
			species: 'cat',
			avatar_url: 'https://cdn.example/doudou.png'
		});
		expect(mapped).not.toHaveProperty('avatarUrl');
		expect(validateSchema('PetWrite', mapped).ok).toBe(true);
	});

	it('omits null and empty optional pet fields', () => {
		const body = petWriteBody({
			name: '豆豆',
			species: 'dog',
			breed: null,
			birthday: '',
			avatarUrl: null
		});
		expect(body).toEqual({ name: '豆豆', species: 'dog' });
		expect(JSON.stringify(body)).not.toContain('null');
		expect(validateSchema('PetWrite', body).ok).toBe(true);
	});

	it('rejects challenge lengths other than 7, 14 or 21', () => {
		expect(() => studyChallengeWriteBody({ name: '马拉松', targetDays: 30 })).toThrow(
			/target_days must be 7, 14 or 21/
		);
		expect(studyChallengeWriteBody({ name: '七日', targetDays: 7 })).toEqual({
			name: '七日',
			target_days: 7
		});
		expect(studyChallengeWriteBody({ name: '两周', targetDays: 14 }).target_days).toBe(14);
		expect(studyChallengeWriteBody({ name: '背单词', targetDays: 21 }).target_days).toBe(21);
	});

	it('omits empty study optionals including parent_id and category', () => {
		expect(studyFlashcardWriteBody({ front: 'a', back: 'b', category: null })).toEqual({
			front: 'a',
			back: 'b'
		});
		expect(studySkillWriteBody({ title: '词根', parentId: null })).toEqual({ title: '词根' });
		expect(studyNoteWriteBody({ title: '动词', contentMd: '', tags: ['语法'] })).toEqual({
			title: '动词',
			tags: ['语法']
		});
		expect(studyCheckinWriteBody({})).toEqual({});
	});
});

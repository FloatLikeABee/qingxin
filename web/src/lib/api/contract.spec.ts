import { describe, expect, it } from 'vitest';
import { elderAckWrite, elderReminderWrite, webPushJobWrite } from '../elder/payload';
import { nextOccurrenceIso } from '../elder/schedule';
import {
	financeBudgetWrite,
	financeChallengeWrite,
	financeSubscriptionWrite,
	financeTransactionWrite
} from '../finance/payload';
import {
	wellnessConsentWrite,
	wellnessCycleWrite,
	wellnessPlanWrite,
	wellnessReminderWrite,
	wellnessReportWrite,
	wellnessSleepWrite,
	wellnessWaterWrite
} from '../wellness/payload';
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
import { CAMEL_BAN, expectOpenApi, validateOpenApi, validateSchema } from './contract';

describe('OpenAPI write contracts', () => {
	it('accepts a salary income transaction and rejects a camelCase body', () => {
		const body = financeTransactionWrite({
			amountFen: 880_000,
			type: 'income',
			categoryId: 'fin-cat-inc-salary',
			note: '',
			occurredOn: '2026-10-13',
			clientId: '11111111-1111-4111-8111-111111111111'
		});
		expect(body).toMatchObject({
			amount_fen: 880_000,
			type: 'income',
			category_id: 'fin-cat-inc-salary',
			occurred_on: '2026-10-13',
			client_id: '11111111-1111-4111-8111-111111111111'
		});
		expect(body).not.toHaveProperty('note');
		expectOpenApi('FinanceTransactionWrite', body);
		expect(validateOpenApi('FinanceTransactionWrite', { amountFen: 1 }).ok).toBe(false);
	});

	it('accepts a subscription write', () => {
		const body = financeSubscriptionWrite({
			name: '音乐会员',
			priceFen: 3000,
			cycle: 'monthly',
			nextBillingDate: '2026-10-15',
			remindDaysBefore: 3
		});
		expect(body).toMatchObject({
			name: '音乐会员',
			price_fen: 3000,
			cycle: 'monthly',
			next_billing_date: '2026-10-15',
			remind_days_before: 3
		});
		expectOpenApi('FinanceSubscriptionWrite', body);
	});

	it('wraps budgets as { items: [] }', () => {
		const body = financeBudgetWrite([
			{ categoryId: 'fin-cat-exp-food', monthlyLimitFen: 100_000, alertThresholdPct: 80 }
		]);
		expect(body).toEqual({
			items: [
				{
					category_id: 'fin-cat-exp-food',
					monthly_limit_fen: 100_000,
					alert_threshold_pct: 80
				}
			]
		});
		expectOpenApi('FinanceBudgetWrite', body);
	});

	it('omits a null challenge target amount', () => {
		const body = financeChallengeWrite({
			name: '不买奶茶 30 天',
			targetDays: 30,
			startDate: '2026-10-01',
			targetAmountFen: null
		});
		expect(body).not.toHaveProperty('target_amount_fen');
		expectOpenApi('FinanceChallengeWrite', body);
	});

	it('writes elder reminders without cron and acks with occurrence_at', () => {
		const reminder = elderReminderWrite({
			title: '降压药',
			body: '早餐后一粒',
			kind: 'medication',
			time: '08:00',
			daysOfWeek: [1, 2, 3, 4, 5],
			voiceText: '该吃降压药了'
		});
		expect(reminder).toMatchObject({
			days_of_week: [1, 2, 3, 4, 5],
			voice_text: '该吃降压药了',
			timezone: 'Asia/Shanghai'
		});
		expect(reminder).not.toHaveProperty('schedule_cron');
		expectOpenApi('ElderReminderCreate', reminder);
		const ack = elderAckWrite('2026-10-13T00:00:00.000Z');
		expect(ack.occurrence_at).toBe('2026-10-13T00:00:00+00:00');
	});

	it('builds a web_push job with offset run_at and title/body payload', () => {
		const runAt = nextOccurrenceIso(
			'08:00',
			[1, 2, 3, 4, 5],
			'Asia/Shanghai',
			new Date('2026-10-13T01:00:00.000Z')
		);
		const body = webPushJobWrite({
			runAt,
			title: '该吃药了',
			body: '早餐后一粒'
		});
		expect(body.kind).toBe('web_push');
		expect(String(body.run_at)).toMatch(/[+-]\d{2}:\d{2}$/);
		expect(body.payload).toEqual({ title: '该吃药了', body: '早餐后一粒' });
		expectOpenApi('CreateJobRequest', body);
	});

	it('writes wellness water, sleep, consent, cycle, report, plan, and time_local reminders', () => {
		expectOpenApi('WellnessWaterWrite', wellnessWaterWrite(250, '2026-10-13'));
		const sleep = wellnessSleepWrite({
			sleepAt: '2026-10-12T16:00:00.000Z',
			wakeAt: '2026-10-13T00:00:00.000Z',
			quality: 4,
			note: ''
		});
		expect(sleep).not.toHaveProperty('note');
		expect(sleep.sleep_at).toBe('2026-10-12T16:00:00+00:00');
		expect(sleep.wake_at).toBe('2026-10-13T00:00:00+00:00');
		expectOpenApi('WellnessSleepWrite', sleep);
		expectOpenApi('WellnessConsentWrite', wellnessConsentWrite(true));
		const cycle = wellnessCycleWrite({ startDate: '2026-08-01', symptoms: '' });
		expect(cycle).not.toHaveProperty('symptoms');
		expectOpenApi('WellnessCycleWrite', cycle);
		expectOpenApi(
			'WellnessReportWrite',
			wellnessReportWrite({
				title: '体检',
				reportDate: '2026-10-01',
				metrics: [{ name: '血压', value: '120/80', unit: 'mmHg' }]
			})
		);
		expectOpenApi('WellnessPlanWrite', wellnessPlanWrite('water_21', '2026-10-13'));
		const reminder = wellnessReminderWrite({
			kind: 'water',
			time: '08:00',
			daysOfWeek: [1, 2, 3, 4, 5, 6, 7]
		});
		expect(reminder).toMatchObject({ time_local: '08:00', days_of_week: [1, 2, 3, 4, 5, 6, 7] });
		expectOpenApi('WellnessReminderWrite', reminder);
	});
});

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

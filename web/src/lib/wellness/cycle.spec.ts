import { describe, expect, it } from 'vitest';
import { PREDICTION_LABEL } from './disclaimer';
import { predictCycle } from './cycle';

describe('cycle prediction', () => {
	it('uses the mean of two 28-day starts and labels 仅供参考', () => {
		const prediction = predictCycle(['2026-08-01', '2026-08-29']);
		expect(prediction.averageLengthDays).toBe(28);
		expect(prediction.nextStart).toBe('2026-09-26');
		expect(prediction.label).toBe(PREDICTION_LABEL);
		expect(prediction.disclaimer).toContain('不构成医疗建议');
	});

	it('defaults to 28 days with a single start', () => {
		const prediction = predictCycle(['2026-10-01']);
		expect(prediction.averageLengthDays).toBe(28);
		expect(prediction.nextStart).toBe('2026-10-29');
	});
});

import { describe, expect, it } from 'vitest';
import { DISCLAIMER, PREDICTION_LABEL } from './disclaimer';

describe('wellness disclaimer', () => {
	it('is the fixed 非医疗建议 notice', () => {
		expect(DISCLAIMER).toBe('本模块为生活习惯记录工具，不构成医疗建议。身体不适请及时就医。');
		expect(PREDICTION_LABEL).toBe('仅供参考');
	});
});

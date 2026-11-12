import { describe, expect, it } from 'vitest';
import { assertCanSendSecret, SECRET_CONSENT_COPY } from './consent';

describe('secret consent', () => {
	it('names private AI reply and non-publication in the consent copy', () => {
		expect(SECRET_CONSENT_COPY).toContain('回信');
		expect(SECRET_CONSENT_COPY).toContain('不会公开');
	});

	it('rejects a letter without consent', () => {
		const result = assertCanSendSecret({ body: '今天有点累。', consented: false });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toContain('同意');
			expect(result.reason).toContain('公开');
		}
	});

	it('rejects an empty letter even with consent', () => {
		const result = assertCanSendSecret({ body: '   ', consented: true });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain('写信');
	});

	it('accepts a consented non-empty letter', () => {
		expect(assertCanSendSecret({ body: '今天有点累。', consented: true })).toEqual({
			ok: true,
			body: '今天有点累。'
		});
	});
});

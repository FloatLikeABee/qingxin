import { describe, expect, it } from 'vitest';
import { composeMailboxReply, SECRET_DISCLAIMER } from './letter';

describe('mailbox reply letter', () => {
	it('writes a letter with salutation and closing, not a chat turn', () => {
		const letter = composeMailboxReply('今天有点累，不想被人看见。');
		expect(letter).toContain('亲爱的来信人');
		expect(letter).toContain('此致');
		expect(letter).toContain('轻心信箱');
		expect(letter).not.toMatch(/用户[:：]/);
		expect(letter).not.toMatch(/助手[:：]/);
		expect(letter).not.toContain('今天有点累，不想被人看见。');
	});

	it('states the module is not counseling', () => {
		expect(SECRET_DISCLAIMER).toContain('不是心理咨询');
		expect(SECRET_DISCLAIMER).toContain('12356');
	});
});

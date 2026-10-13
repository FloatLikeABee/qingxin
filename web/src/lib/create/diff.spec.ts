import { describe, expect, it } from 'vitest';
import { diffLines } from './diff';

describe('diffLines', () => {
	it('marks an added line', () => {
		const hunks = diffLines('你好', '你好\n世界');
		expect(hunks).toEqual([
			{ type: 'equal', text: '你好' },
			{ type: 'add', text: '世界' }
		]);
	});

	it('marks a removed line', () => {
		const hunks = diffLines('你好\n世界', '你好');
		expect(hunks).toEqual([
			{ type: 'equal', text: '你好' },
			{ type: 'remove', text: '世界' }
		]);
	});
});

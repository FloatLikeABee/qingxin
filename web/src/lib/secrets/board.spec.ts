import { describe, expect, it } from 'vitest';
import { envelopesOnBoard, type SecretThread } from './board';

describe('secret letter board', () => {
	it('lays secret and reply as separate envelopes, not a chat transcript', () => {
		const threads: SecretThread[] = [
			{
				id: 'pair-1',
				secret: {
					id: 's1',
					role: 'secret',
					title: '未署名的信',
					body: '今天有点累。',
					createdAt: '2026-11-12T01:00:00Z'
				},
				reply: {
					id: 'r1',
					role: 'reply',
					title: '信箱回信',
					body: '亲爱的来信人：\n\n信已收到。\n\n此致\n轻心信箱',
					createdAt: '2026-11-12T01:00:01Z'
				}
			}
		];
		const board = envelopesOnBoard(threads);
		expect(board).toHaveLength(2);
		expect(board.map((item) => item.role)).toEqual(['secret', 'reply']);
		expect(board.every((item) => item.kind === 'envelope')).toBe(true);
		expect(board.some((item) => item.layout === 'chat')).toBe(false);
		expect(board[0]?.from).toBe('me');
		expect(board[1]?.from).toBe('mailbox');
	});
});

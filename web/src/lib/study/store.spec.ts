import { describe, expect, it } from 'vitest';
import { DISCLAIMER } from './disclaimer';
import { MemoryStudyStore } from './store';

describe('MemoryStudyStore', () => {
	it('derives streak from unique consecutive days', () => {
		const store = new MemoryStudyStore();
		const challenge = store.createChallenge({ name: '背单词', targetDays: 21 });
		store.checkin(challenge.id, '2026-10-13');
		store.checkin(challenge.id, '2026-10-13');
		store.checkin(challenge.id, '2026-10-12');
		store.checkin(challenge.id, '2026-10-11');
		const today = store.today('2026-10-13');
		expect(today.challenges[0].currentStreak).toBe(3);
		expect(today.challenges[0].progressDays).toBe(3);
		expect(today.disclaimer).toBe(DISCLAIMER);
	});

	it('advances a good review past interval 1', () => {
		const store = new MemoryStudyStore();
		const card = store.addCard({ front: '过去分词', back: 'done' });
		store.review(card.id, 'good', '2026-10-13');
		const after = store.review(card.id, 'good', '2026-10-13');
		expect(after.intervalDays).toBe(6);
		expect(after.nextReviewDate).toBe('2026-10-19');
	});

	it('searches notes by title and tags not body', () => {
		const store = new MemoryStudyStore();
		store.addNote({ title: '动词', contentMd: '秘密句子', tags: ['语法'] });
		expect(store.searchNotes('动词')).toHaveLength(1);
		expect(store.searchNotes('语法')).toHaveLength(1);
		expect(store.searchNotes('秘密句子')).toHaveLength(0);
	});

	it('toggles skill unlock', () => {
		const store = new MemoryStudyStore();
		const node = store.addSkill({ title: '词根' });
		expect(node.unlocked).toBe(true);
		store.toggleSkill(node.id);
		expect(store.skills[0].unlocked).toBe(false);
	});
});

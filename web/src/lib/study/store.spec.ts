import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { MockQingxinApi, resetApi } from '../api/client';
import { DISCLAIMER } from './disclaimer';
import { shiftDay } from './review';
import { shanghaiToday } from './streak';
import { resetStudyStore } from './store';

afterEach(async () => {
	resetApi();
	resetStudyStore();
	await new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase('qingxin');
		request.onsuccess = () => resolve();
		request.onerror = () => resolve();
		request.onblocked = () => resolve();
	});
});

async function authedStore() {
	const api = new MockQingxinApi();
	resetApi(api);
	await api.register('Ada', 'ada-study@qingxin.app', 'password1');
	return resetStudyStore();
}

describe('StudyStore', () => {
	it('derives streak from unique consecutive days', async () => {
		const store = await authedStore();
		const challenge = await store.createChallenge({ name: '背单词', targetDays: 21 });
		const today = shanghaiToday();
		await store.checkin(challenge.id, today);
		await store.checkin(challenge.id, today);
		await store.checkin(challenge.id, shiftDay(today, -1));
		await store.checkin(challenge.id, shiftDay(today, -2));
		const snap = store.today(today);
		expect(snap.challenges[0].currentStreak).toBe(3);
		expect(snap.challenges[0].progressDays).toBe(3);
		expect(snap.disclaimer).toBe(DISCLAIMER);
	});

	it('advances a good review past interval 1', async () => {
		const store = await authedStore();
		const card = await store.addCard({ front: '过去分词', back: 'done' });
		await store.review(card.id, 'good');
		const after = await store.review(card.id, 'good');
		expect(after.intervalDays).toBe(6);
	});

	it('searches notes by title and tags not body', async () => {
		const store = await authedStore();
		await store.addNote({ title: '动词', contentMd: '秘密句子', tags: ['语法'] });
		expect(store.searchNotes('动词')).toHaveLength(1);
		expect(store.searchNotes('语法')).toHaveLength(1);
		expect(store.searchNotes('秘密句子')).toHaveLength(0);
	});

	it('toggles skill unlock', async () => {
		const store = await authedStore();
		const node = await store.addSkill({ title: '词根' });
		expect(node.unlocked).toBe(true);
		await store.toggleSkill(node.id);
		expect(store.skills[0].unlocked).toBe(false);
	});

	it('copies skill templates from the server catalog', async () => {
		const store = await authedStore();
		await store.load();
		expect(store.templates.map((item) => item.id)).toEqual(['english-vocab', 'piano']);
		const created = await store.applyTemplate('english-vocab');
		expect(created.map((item) => item.title)).toEqual(['词根', '单词', '例句']);
	});
});

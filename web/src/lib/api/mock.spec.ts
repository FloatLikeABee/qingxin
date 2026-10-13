import { describe, expect, it } from 'vitest';
import { ApiError, MockQingxinApi } from './mock';
import { MODULES } from '../modules';

describe('MockQingxinApi', () => {
	it('rejects empty login credentials with a typed error', async () => {
		const api = new MockQingxinApi();
		await expect(api.login('', '')).rejects.toMatchObject({
			code: 'invalid_credentials'
		});
		await expect(api.login('', '')).rejects.toBeInstanceOf(ApiError);
	});

	it('returns a session for known-good credentials', async () => {
		const api = new MockQingxinApi();
		const session = await api.login('demo@qingxin.app', 'qingxin');
		expect(session.userId).toBeTruthy();
		expect(session.displayName).toBeTruthy();
		await expect(api.getSession()).resolves.toEqual(session);
	});

	it('restores a session from localStorage after a new client is created', async () => {
		const memory = new Map<string, string>();
		const fake = {
			getItem: (key: string) => memory.get(key) ?? null,
			setItem: (key: string, value: string) => {
				memory.set(key, value);
			},
			removeItem: (key: string) => {
				memory.delete(key);
			}
		};
		Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });
		const api = new MockQingxinApi();
		await api.login('demo@qingxin.app', 'qingxin');
		const restored = new MockQingxinApi();
		await expect(restored.getSession()).resolves.toMatchObject({ email: 'demo@qingxin.app' });
	});

	it('registers a user and stores the session', async () => {
		const api = new MockQingxinApi();
		const session = await api.register('林轻心', 'lin@qingxin.app', 'secret12');
		expect(session.displayName).toBe('林轻心');
		await expect(api.getSession()).resolves.toMatchObject({ userId: session.userId });
	});

	it('lists the ten product modules', async () => {
		const api = new MockQingxinApi();
		const modules = await api.listModules();
		expect(modules.map((item) => item.name)).toEqual(MODULES.map((item) => item.name));
		expect(modules).toHaveLength(10);
	});

	it('exports a JSON payload for the current session', async () => {
		const api = new MockQingxinApi();
		await api.login('demo@qingxin.app', 'qingxin');
		const exported = await api.exportUserData();
		expect(exported.exportedAt).toBeTruthy();
		expect(exported.data).toMatchObject({ email: 'demo@qingxin.app' });
	});

	it('clears the session after account deletion', async () => {
		const api = new MockQingxinApi();
		await api.login('demo@qingxin.app', 'qingxin');
		await api.deleteAccount();
		await expect(api.getSession()).resolves.toBeNull();
	});

	it('creates a mood log and rejects a 100-character note', async () => {
		const api = new MockQingxinApi();
		await api.login('demo@qingxin.app', 'qingxin');
		const log = await api.createMoodLog({ emoji: '😔', tags: ['睡眠'], note: '夜里醒了两次' });
		expect(log.score).toBe(2);
		expect(log.note).toBe('夜里醒了两次');
		await expect(
			api.createMoodLog({ emoji: '🙂', tags: [], note: '字'.repeat(100) })
		).rejects.toMatchObject({ code: 'invalid_request' });
		const listed = await api.listMoodLogs();
		expect(listed.some((item) => item.id === log.id)).toBe(true);
	});

	it('returns a mock insight with a non-medical disclaimer', async () => {
		const api = new MockQingxinApi();
		await api.login('demo@qingxin.app', 'qingxin');
		const insight = await api.createMoodInsight({ emoji: '😔', tags: ['睡眠'] });
		expect(insight.source).toBe('mock');
		expect(insight.disclaimer).toContain('不构成医疗建议');
		expect(insight.text.length).toBeGreaterThan(4);
	});

	it('lists the meditation catalog ids', async () => {
		const api = new MockQingxinApi();
		await api.login('demo@qingxin.app', 'qingxin');
		const catalog = await api.getMeditationCatalog();
		expect(catalog.sounds.map((item) => item.id)).toEqual(['rain', 'waves', 'fan', 'fire', 'white']);
		expect(catalog.stories.length).toBeGreaterThanOrEqual(2);
		const session = await api.createMeditationSession({ kind: 'breathe', durationSec: 76 });
		expect(session.kind).toBe('breathe');
	});
});

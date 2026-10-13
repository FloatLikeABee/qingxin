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
});

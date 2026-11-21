import { describe, expect, it } from 'vitest';
import { MOCK_DEMO_EMAIL, MOCK_DEMO_PASSWORD } from '../api/mockCredentials';
import { loginFormDefaults, loginHelpText } from './loginCopy';

describe('login copy', () => {
	it('keeps mock demo defaults only for the in-memory API', () => {
		expect(loginFormDefaults(false)).toEqual({
			email: MOCK_DEMO_EMAIL,
			password: MOCK_DEMO_PASSWORD
		});
		expect(loginHelpText(false)).toContain(MOCK_DEMO_EMAIL);
		expect(loginHelpText(false)).toContain(MOCK_DEMO_PASSWORD);
	});

	it('does not advertise mock demo credentials when talking to Axum', () => {
		expect(loginFormDefaults(true)).toEqual({ email: '', password: '' });
		expect(loginHelpText(true)).not.toContain(MOCK_DEMO_EMAIL);
		expect(loginHelpText(true)).not.toContain(MOCK_DEMO_PASSWORD);
		expect(loginHelpText(true)).toMatch(/注册/);
		expect(loginHelpText(true)).not.toMatch(/演示账号/);
	});
});

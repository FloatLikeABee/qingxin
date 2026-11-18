import { MOCK_DEMO_EMAIL, MOCK_DEMO_PASSWORD } from '../api/mockCredentials';

export function loginFormDefaults(http: boolean): { email: string; password: string } {
	if (http) return { email: '', password: '' };
	return { email: MOCK_DEMO_EMAIL, password: MOCK_DEMO_PASSWORD };
}

export function loginHelpText(http: boolean): string {
	if (http) return '请使用已注册账号登录。没有账号就先创建。';
	return `演示账号 ${MOCK_DEMO_EMAIL} / ${MOCK_DEMO_PASSWORD}`;
}

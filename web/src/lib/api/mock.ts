import { MODULES } from '../modules';
import { ApiError, type ExportPayload, type QingxinApi, type Session } from './types';

export { ApiError } from './types';
export type { QingxinApi, Session } from './types';

const DEMO_EMAIL = 'demo@qingxin.app';
const DEMO_PASSWORD = 'qingxin';

export class MockQingxinApi implements QingxinApi {
	#session: Session | null = null;

	async getSession(): Promise<Session | null> {
		return this.#session;
	}

	async login(email: string, password: string): Promise<Session> {
		if (!email.trim() || !password.trim()) {
			throw new ApiError('invalid_credentials', '请输入邮箱和密码');
		}
		if (email !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
			throw new ApiError('invalid_credentials', '账号或密码不正确');
		}
		this.#session = {
			userId: 'user-demo',
			displayName: '轻心同学',
			email: DEMO_EMAIL,
			token: 'mock-token-demo'
		};
		return this.#session;
	}

	async register(name: string, email: string, password: string): Promise<Session> {
		if (!name.trim() || !email.trim() || password.length < 6) {
			throw new ApiError('invalid_credentials', '请填写姓名、邮箱，密码至少 6 位');
		}
		this.#session = {
			userId: `user-${email}`,
			displayName: name.trim(),
			email: email.trim(),
			token: 'mock-token-new'
		};
		return this.#session;
	}

	async logout(): Promise<void> {
		this.#session = null;
	}

	async listModules() {
		return MODULES;
	}

	async exportUserData(): Promise<ExportPayload> {
		if (!this.#session) {
			throw new ApiError('unauthenticated', '请先登录后再导出数据');
		}
		return {
			exportedAt: new Date().toISOString(),
			data: {
				email: this.#session.email,
				displayName: this.#session.displayName,
				modules: MODULES.map((item) => item.name)
			}
		};
	}

	async deleteAccount(): Promise<void> {
		this.#session = null;
	}
}

let singleton: QingxinApi | undefined;

export function getApi(): QingxinApi {
	singleton ??= new MockQingxinApi();
	return singleton;
}

export function resetApi(next: QingxinApi = new MockQingxinApi()) {
	singleton = next;
}

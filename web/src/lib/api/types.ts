import type { ModuleInfo } from '../modules';

export interface Session {
	userId: string;
	displayName: string;
	email: string;
	token: string;
}

export interface ExportPayload {
	exportedAt: string;
	data: {
		email: string;
		displayName: string;
		modules: string[];
	};
}

export interface QingxinApi {
	getSession(): Promise<Session | null>;
	login(email: string, password: string): Promise<Session>;
	register(name: string, email: string, password: string): Promise<Session>;
	logout(): Promise<void>;
	listModules(): Promise<ModuleInfo[]>;
	exportUserData(): Promise<ExportPayload>;
	deleteAccount(): Promise<void>;
}

export class ApiError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = 'ApiError';
		this.code = code;
	}
}

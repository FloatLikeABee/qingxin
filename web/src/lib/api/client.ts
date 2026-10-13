import { readPublicApiUrl } from './env';
import { HttpQingxinApi } from './http';
import { MockQingxinApi } from './mock';
import type { QingxinApi } from './types';

/**
 * Factory for the typed Qingxin API.
 *
 * - `PUBLIC_API_URL` set → `HttpQingxinApi` against that origin (`/v1`).
 * - unset / blank → `MockQingxinApi` (unit tests, screenshot E2E, local demo).
 *
 * Screens should import `getApi` from this module, not from `mock.ts`.
 */
let singleton: QingxinApi | undefined;

export function createApi(env?: { PUBLIC_API_URL?: unknown }): QingxinApi {
	const url = readPublicApiUrl(
		env ?? { PUBLIC_API_URL: import.meta.env.PUBLIC_API_URL as string | undefined }
	);
	return url ? new HttpQingxinApi({ baseUrl: url }) : new MockQingxinApi();
}

export function getApi(): QingxinApi {
	singleton ??= createApi();
	return singleton;
}

export function resetApi(next: QingxinApi = new MockQingxinApi()): void {
	singleton = next;
}

export { HttpQingxinApi } from './http';
export { MockQingxinApi } from './mock';
export { ApiError } from './types';
export type { QingxinApi, Session } from './types';

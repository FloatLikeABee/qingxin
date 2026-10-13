import { afterEach, describe, expect, it } from 'vitest';
import { createApi, getApi, resetApi } from './client';
import { HttpQingxinApi } from './http';
import { MockQingxinApi } from './mock';

afterEach(() => {
	resetApi();
});

describe('createApi / getApi', () => {
	it('returns MockQingxinApi when PUBLIC_API_URL is unset', () => {
		expect(createApi({})).toBeInstanceOf(MockQingxinApi);
		expect(createApi({ PUBLIC_API_URL: '' })).toBeInstanceOf(MockQingxinApi);
	});

	it('returns HttpQingxinApi when PUBLIC_API_URL is set', () => {
		const api = createApi({ PUBLIC_API_URL: 'http://127.0.0.1:8080/' });
		expect(api).toBeInstanceOf(HttpQingxinApi);
	});

	it('reads PUBLIC_API_URL from a static import.meta.env path', () => {
		expect(
			createApi({
				PUBLIC_API_URL: import.meta.env.PUBLIC_API_URL as string | undefined
			})
		).toBeInstanceOf(
			typeof import.meta.env.PUBLIC_API_URL === 'string' && import.meta.env.PUBLIC_API_URL.trim()
				? HttpQingxinApi
				: MockQingxinApi
		);
	});

	it('getApi memoises until resetApi', () => {
		const first = getApi();
		expect(first).toBeInstanceOf(MockQingxinApi);
		expect(getApi()).toBe(first);
		const injected = new MockQingxinApi();
		resetApi(injected);
		expect(getApi()).toBe(injected);
	});
});

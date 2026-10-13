import { describe, expect, it } from 'vitest';
import { readPublicApiUrl } from './env';

describe('readPublicApiUrl', () => {
	it('returns undefined when the env var is unset', () => {
		expect(readPublicApiUrl({})).toBeUndefined();
		expect(readPublicApiUrl({ PUBLIC_API_URL: undefined })).toBeUndefined();
	});

	it('returns undefined when the env var is blank', () => {
		expect(readPublicApiUrl({ PUBLIC_API_URL: '' })).toBeUndefined();
		expect(readPublicApiUrl({ PUBLIC_API_URL: '   ' })).toBeUndefined();
	});

	it('strips a trailing slash from a set URL', () => {
		expect(readPublicApiUrl({ PUBLIC_API_URL: 'http://127.0.0.1:8080/' })).toBe(
			'http://127.0.0.1:8080'
		);
		expect(readPublicApiUrl({ PUBLIC_API_URL: ' http://127.0.0.1:8080 ' })).toBe(
			'http://127.0.0.1:8080'
		);
	});
});

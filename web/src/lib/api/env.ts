export function readPublicApiUrl(
	env: { PUBLIC_API_URL?: unknown } = {
		// Direct member access so Vite inlines PUBLIC_API_URL at build time.
		// Spreading the whole `import.meta.env` object drops custom keys from the
		// production client bundle (only BASE_URL/DEV/MODE/PROD/SSR remain).
		PUBLIC_API_URL: import.meta.env.PUBLIC_API_URL
	}
): string | undefined {
	const raw = env.PUBLIC_API_URL;
	if (typeof raw !== 'string') return undefined;
	const trimmed = raw.trim();
	if (!trimmed) return undefined;
	return trimmed.replace(/\/+$/, '');
}

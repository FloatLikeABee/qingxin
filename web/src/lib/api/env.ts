export function readPublicApiUrl(
	env: { PUBLIC_API_URL?: unknown } = {
		PUBLIC_API_URL: import.meta.env.PUBLIC_API_URL as string | undefined
	}
): string | undefined {
	const raw = env.PUBLIC_API_URL;
	if (typeof raw !== 'string') return undefined;
	const trimmed = raw.trim();
	if (!trimmed) return undefined;
	return trimmed.replace(/\/+$/, '');
}

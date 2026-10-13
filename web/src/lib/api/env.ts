export function readPublicApiUrl(
	env: { PUBLIC_API_URL?: unknown } = import.meta.env as { PUBLIC_API_URL?: unknown }
): string | undefined {
	const raw = env.PUBLIC_API_URL;
	if (typeof raw !== 'string') return undefined;
	const trimmed = raw.trim();
	if (!trimmed) return undefined;
	return trimmed.replace(/\/+$/, '');
}

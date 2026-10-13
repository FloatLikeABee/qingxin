export function omitEmpty(record: Record<string, unknown>): Record<string, unknown> {
	const next: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(record)) {
		if (value === undefined || value === '') continue;
		next[key] = value;
	}
	return next;
}

export function withNumericOffset(rfc3339: string): string {
	if (/[+-]\d{2}:\d{2}$/.test(rfc3339)) {
		return rfc3339.replace(/\.\d{3}(?=[+-]\d{2}:\d{2}$)/, '');
	}
	const date = new Date(rfc3339);
	if (Number.isNaN(date.getTime())) return rfc3339;
	return date.toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

export function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

export function asString(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function asStringList(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === 'string')
		: [];
}

export function asNumberList(value: unknown): number[] {
	return Array.isArray(value)
		? value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
		: [];
}

export function itemsOf(value: unknown): unknown[] {
	const rec = asRecord(value);
	if (Array.isArray(rec.items)) return rec.items;
	return Array.isArray(value) ? value : [];
}

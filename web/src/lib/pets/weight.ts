export function formatKg(weightG: number): string {
	return `${(weightG / 1000).toFixed(2)} kg`;
}

export function parseGrams(raw: string): number | null {
	const value = Number.parseInt(raw.trim(), 10);
	if (!Number.isFinite(value) || value <= 0) return null;
	return value;
}

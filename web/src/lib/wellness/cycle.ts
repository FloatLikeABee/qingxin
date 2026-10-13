import { DISCLAIMER, PREDICTION_LABEL } from './disclaimer';

export interface CyclePrediction {
	averageLengthDays: number;
	sampleCount: number;
	lastStart: string;
	nextStart: string;
	fertileStart: string;
	fertileEnd: string;
	label: string;
	disclaimer: string;
}

function parseDay(raw: string): Date {
	return new Date(`${raw}T00:00:00Z`);
}

function isoDay(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function addDays(raw: string, days: number): string {
	const date = parseDay(raw);
	date.setUTCDate(date.getUTCDate() + days);
	return isoDay(date);
}

function dayDiff(from: string, to: string): number {
	return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000);
}

export function predictCycle(starts: string[]): CyclePrediction {
	const ordered = [...starts].sort();
	const lengths: number[] = [];
	for (let i = 1; i < ordered.length; i += 1) {
		lengths.push(dayDiff(ordered[i - 1], ordered[i]));
	}
	const sample = lengths.slice(-6);
	const averageLengthDays = sample.length
		? Math.round(sample.reduce((sum, value) => sum + value, 0) / sample.length)
		: 28;
	const lastStart = ordered.at(-1) ?? isoDay(new Date());
	const nextStart = addDays(lastStart, averageLengthDays);
	const ovulation = addDays(nextStart, -14);
	return {
		averageLengthDays,
		sampleCount: sample.length,
		lastStart,
		nextStart,
		fertileStart: addDays(ovulation, -5),
		fertileEnd: addDays(ovulation, 1),
		label: PREDICTION_LABEL,
		disclaimer: DISCLAIMER
	};
}

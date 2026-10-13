export const WORK_SECONDS = 25 * 60;
export const BREAK_SECONDS = 5 * 60;

export type FocusPhase = 'work' | 'break';

export function remaining(total: number, elapsed: number): number {
	return Math.max(0, total - elapsed);
}

export function formatMmSs(seconds: number): string {
	const safe = Math.max(0, Math.floor(seconds));
	const m = Math.floor(safe / 60);
	const s = safe % 60;
	return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function nextPhase(phase: FocusPhase): FocusPhase {
	return phase === 'work' ? 'break' : 'work';
}

export function phaseSeconds(phase: FocusPhase): number {
	return phase === 'work' ? WORK_SECONDS : BREAK_SECONDS;
}

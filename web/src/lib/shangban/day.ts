export const TICK_MS = 100;
export const DAY_TICKS = 720;

export type DayPhase = 'arrival' | 'morning' | 'lunch' | 'afternoon' | 'closing';
export type SimSpeed = 1 | 2 | 3;

export function clampDayTick(tick: number): number {
	if (!Number.isFinite(tick)) return 0;
	return Math.min(DAY_TICKS, Math.max(0, tick));
}

export function clockLabel(tick: number): string {
	const t = clampDayTick(tick);
	const minutes = Math.floor((t / DAY_TICKS) * 9 * 60);
	const hour = 9 + Math.floor(minutes / 60);
	const min = minutes % 60;
	return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function clockHour(tick: number): number {
	return Number(clockLabel(tick).slice(0, 2));
}

export function dayPhase(tick: number): DayPhase {
	const t = clampDayTick(tick);
	const hour = 9 + (t / DAY_TICKS) * 9;
	if (hour < 9.5) return 'arrival';
	if (hour < 12) return 'morning';
	if (hour < 13) return 'lunch';
	if (hour < 17.5) return 'afternoon';
	return 'closing';
}

export function phaseLabel(phase: DayPhase): string {
	if (phase === 'arrival') return '到岗';
	if (phase === 'morning') return '上午';
	if (phase === 'lunch') return '午休';
	if (phase === 'afternoon') return '下午';
	return '收工';
}

export function remainingJobSeconds(ticksLeft: number, speed: SimSpeed): number {
	return (Math.max(0, ticksLeft) * (TICK_MS / 1000)) / speed;
}

export type Grade = 'again' | 'hard' | 'good' | 'easy';

export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;

export interface ReviewState {
	ease: number;
	intervalDays: number;
}

export function applyGrade(state: ReviewState, grade: Grade): ReviewState {
	if (grade === 'again') {
		return { ease: Math.max(MIN_EASE, state.ease - 0.2), intervalDays: 1 };
	}
	if (grade === 'hard') {
		return {
			ease: Math.max(MIN_EASE, state.ease - 0.15),
			intervalDays: state.intervalDays <= 1 ? 1 : Math.max(1, Math.round(state.intervalDays * 1.2))
		};
	}
	if (grade === 'good') {
		const intervalDays =
			state.intervalDays === 0
				? 1
				: state.intervalDays === 1
					? 6
					: Math.max(1, Math.round(state.intervalDays * state.ease));
		return { ease: state.ease, intervalDays };
	}
	return {
		ease: state.ease + 0.15,
		intervalDays:
			state.intervalDays === 0 ? 4 : Math.max(1, Math.round(state.intervalDays * state.ease * 1.3))
	};
}

export function shiftDay(iso: string, days: number): string {
	const date = new Date(`${iso}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

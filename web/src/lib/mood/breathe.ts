export const INHALE_SECONDS = 4;
export const HOLD_SECONDS = 7;
export const EXHALE_SECONDS = 8;
export const CYCLE_SECONDS = INHALE_SECONDS + HOLD_SECONDS + EXHALE_SECONDS;

export type BreathePhaseId = 'inhale' | 'hold' | 'exhale';

export interface BreathePhase {
	id: BreathePhaseId;
	label: string;
	progress: number;
}

export function breathePhase(elapsedSeconds: number): BreathePhase {
	const t = ((elapsedSeconds % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;
	if (t < INHALE_SECONDS) {
		return { id: 'inhale', label: '吸气', progress: t / INHALE_SECONDS };
	}
	if (t < INHALE_SECONDS + HOLD_SECONDS) {
		return {
			id: 'hold',
			label: '屏息',
			progress: (t - INHALE_SECONDS) / HOLD_SECONDS
		};
	}
	return {
		id: 'exhale',
		label: '呼气',
		progress: (t - INHALE_SECONDS - HOLD_SECONDS) / EXHALE_SECONDS
	};
}

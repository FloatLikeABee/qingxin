export const STEM_IDS = ['rose', 'peony', 'tulip', 'lily', 'hydrangea', 'eucalyptus'] as const;
export type StemId = (typeof STEM_IDS)[number];
export type Mood = '暖' | '静' | '亮';

export interface StemDef {
	id: StemId;
	name: string;
	mood: Mood;
	color: string;
	greenery?: boolean;
}

export const STEMS: Record<StemId, StemDef> = {
	rose: { id: 'rose', name: '玫瑰', mood: '暖', color: '#C45C6A' },
	peony: { id: 'peony', name: '芍药', mood: '暖', color: '#F97316' },
	tulip: { id: 'tulip', name: '郁金香', mood: '亮', color: '#EAB308' },
	lily: { id: 'lily', name: '百合', mood: '静', color: '#E8D5B5' },
	hydrangea: { id: 'hydrangea', name: '绣球', mood: '静', color: '#3B82F6' },
	eucalyptus: { id: 'eucalyptus', name: '尤加利', mood: '静', color: '#14B8A6', greenery: true }
};

export function emptyBuckets(): Record<StemId, number> {
	return { rose: 8, peony: 8, tulip: 8, lily: 8, hydrangea: 8, eucalyptus: 8 };
}

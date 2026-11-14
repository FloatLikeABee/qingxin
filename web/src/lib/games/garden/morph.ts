export const MORPH_FAMILIES = [
	'herb',
	'leafy',
	'flower',
	'vine',
	'fruiting',
	'rosette',
	'tree',
	'succulent',
	'grass',
	'aquatic'
] as const;

export type MorphFamily = (typeof MORPH_FAMILIES)[number];

export type LeafShape =
	'oval' | 'lance' | 'palmate' | 'needle' | 'frond' | 'round' | 'heart' | 'compound';
export type BloomKind =
	'none' | 'disc' | 'spike' | 'cluster' | 'bell' | 'cup' | 'umbrella' | 'star';
export type FruitKind =
	'none' | 'berry' | 'pod' | 'bulb' | 'head' | 'gourd' | 'drupe' | 'ear' | 'cluster';

export interface Morph {
	family: MorphFamily;
	height: number;
	stemCount: number;
	leafShape: LeafShape;
	leafCount: number;
	bloomKind: BloomKind;
	fruitKind: FruitKind;
}

export function morphKey(morph: Morph): string {
	return [
		morph.family,
		morph.leafShape,
		morph.bloomKind,
		morph.fruitKind,
		String(morph.stemCount),
		morph.height.toFixed(2),
		String(morph.leafCount)
	].join('/');
}

export const FAMILY_LABEL: Record<MorphFamily, string> = {
	herb: '香草',
	leafy: '叶菜',
	flower: '花卉',
	vine: '藤蔓',
	fruiting: '果蔬',
	rosette: '莲座',
	tree: '树木',
	succulent: '多肉',
	grass: '禾本',
	aquatic: '水生'
};

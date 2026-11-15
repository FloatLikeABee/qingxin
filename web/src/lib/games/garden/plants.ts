import { type Morph } from './morph';

export type Need = 'low' | 'mid' | 'high';

export interface PlantDef {
	id: string;
	name: string;
	morph: Morph;
	water: Need;
	light: Need;
	nutrient: Need;
	stageTicks: number;
	harvestValue: number;
	seedCost: number;
	unlockAt: number;
	palette: { stem: string; leaf: string; bloom: string };
}

export const VEG_IDS = [
	'tomato',
	'cucumber',
	'eggplant',
	'chili',
	'carrot',
	'radish',
	'cabbage',
	'lettuce',
	'spinach',
	'scallion'
] as const;

export type VegId = (typeof VEG_IDS)[number];

function plant(
	id: VegId,
	name: string,
	water: Need,
	light: Need,
	nutrient: Need,
	harvestValue: number,
	seedCost: number,
	palette: PlantDef['palette'],
	morph: Morph
): PlantDef {
	return {
		id,
		name,
		morph,
		water,
		light,
		nutrient,
		stageTicks: 8,
		harvestValue,
		seedCost,
		unlockAt: 0,
		palette
	};
}

export const PLANTS: PlantDef[] = [
	plant(
		'tomato',
		'番茄',
		'mid',
		'high',
		'mid',
		14,
		6,
		{ stem: '#4d7c0f', leaf: '#65a30d', bloom: '#ef4444' },
		{
			family: 'fruiting',
			height: 1.35,
			stemCount: 2,
			leafShape: 'compound',
			leafCount: 8,
			bloomKind: 'cluster',
			fruitKind: 'berry'
		}
	),
	plant(
		'cucumber',
		'黄瓜',
		'high',
		'high',
		'mid',
		12,
		6,
		{ stem: '#3f6212', leaf: '#4d7c0f', bloom: '#22c55e' },
		{
			family: 'vine',
			height: 1.1,
			stemCount: 1,
			leafShape: 'palmate',
			leafCount: 10,
			bloomKind: 'cup',
			fruitKind: 'gourd'
		}
	),
	plant(
		'eggplant',
		'茄子',
		'mid',
		'high',
		'high',
		15,
		7,
		{ stem: '#3f6212', leaf: '#65a30d', bloom: '#7c3aed' },
		{
			family: 'fruiting',
			height: 1.05,
			stemCount: 1,
			leafShape: 'oval',
			leafCount: 8,
			bloomKind: 'cup',
			fruitKind: 'berry'
		}
	),
	plant(
		'chili',
		'辣椒',
		'low',
		'high',
		'mid',
		13,
		6,
		{ stem: '#365314', leaf: '#4d7c0f', bloom: '#f97316' },
		{
			family: 'fruiting',
			height: 0.9,
			stemCount: 2,
			leafShape: 'lance',
			leafCount: 9,
			bloomKind: 'cluster',
			fruitKind: 'berry'
		}
	),
	plant(
		'carrot',
		'胡萝卜',
		'mid',
		'high',
		'low',
		11,
		5,
		{ stem: '#3f6212', leaf: '#65a30d', bloom: '#f97316' },
		{
			family: 'rosette',
			height: 0.38,
			stemCount: 1,
			leafShape: 'lance',
			leafCount: 11,
			bloomKind: 'none',
			fruitKind: 'bulb'
		}
	),
	plant(
		'radish',
		'萝卜',
		'mid',
		'high',
		'low',
		11,
		5,
		{ stem: '#4d7c0f', leaf: '#86efac', bloom: '#fb7185' },
		{
			family: 'rosette',
			height: 0.32,
			stemCount: 1,
			leafShape: 'oval',
			leafCount: 9,
			bloomKind: 'none',
			fruitKind: 'bulb'
		}
	),
	plant(
		'cabbage',
		'白菜',
		'high',
		'mid',
		'high',
		12,
		6,
		{ stem: '#4d7c0f', leaf: '#ecfccb', bloom: '#d9f99d' },
		{
			family: 'leafy',
			height: 0.5,
			stemCount: 1,
			leafShape: 'round',
			leafCount: 18,
			bloomKind: 'none',
			fruitKind: 'head'
		}
	),
	plant(
		'lettuce',
		'生菜',
		'high',
		'mid',
		'mid',
		10,
		5,
		{ stem: '#4d7c0f', leaf: '#86efac', bloom: '#bbf7d0' },
		{
			family: 'leafy',
			height: 0.55,
			stemCount: 1,
			leafShape: 'round',
			leafCount: 12,
			bloomKind: 'none',
			fruitKind: 'head'
		}
	),
	plant(
		'spinach',
		'菠菜',
		'high',
		'low',
		'mid',
		10,
		5,
		{ stem: '#14532d', leaf: '#166534', bloom: '#15803d' },
		{
			family: 'leafy',
			height: 0.4,
			stemCount: 1,
			leafShape: 'oval',
			leafCount: 14,
			bloomKind: 'none',
			fruitKind: 'none'
		}
	),
	plant(
		'scallion',
		'小葱',
		'mid',
		'high',
		'low',
		9,
		4,
		{ stem: '#4d7c0f', leaf: '#86efac', bloom: '#bbf7d0' },
		{
			family: 'grass',
			height: 0.62,
			stemCount: 7,
			leafShape: 'lance',
			leafCount: 10,
			bloomKind: 'none',
			fruitKind: 'none'
		}
	)
];

const LEGACY_PLANT_MAP: Record<string, VegId> = {
	tomato: 'tomato',
	cucumber: 'cucumber',
	eggplant: 'eggplant',
	chili: 'chili',
	carrot: 'carrot',
	radish: 'radish',
	cabbage: 'cabbage',
	lettuce: 'lettuce',
	spinach: 'spinach',
	scallion: 'scallion',
	onion: 'scallion',
	garlic: 'scallion',
	mint: 'scallion',
	basil: 'scallion',
	parsley: 'scallion',
	thyme: 'scallion',
	sage: 'scallion',
	coriander: 'scallion',
	celery: 'scallion',
	bokchoy: 'cabbage',
	kale: 'cabbage',
	potato: 'carrot',
	strawberry: 'tomato',
	blueberry: 'tomato',
	melon: 'cucumber',
	pumpkin: 'cucumber',
	zucchini: 'cucumber',
	pea: 'cucumber',
	bean: 'cucumber',
	grape: 'cucumber',
	morningglory: 'cucumber',
	corn: 'scallion',
	rice: 'scallion',
	wheat: 'scallion',
	sunflower: 'chili',
	daisy: 'chili',
	tulip: 'chili',
	hibiscus: 'chili',
	marigold: 'chili',
	rose: 'chili',
	peony: 'chili',
	orchid: 'chili',
	chrysanthemum: 'chili',
	jasmine: 'chili',
	fern: 'lettuce',
	moss: 'lettuce',
	cactus: 'radish',
	aloe: 'radish',
	succulent: 'radish',
	echeveria: 'radish',
	lotus: 'spinach',
	papyrus: 'spinach',
	apple: 'eggplant',
	pear: 'eggplant',
	peach: 'eggplant',
	persimmon: 'eggplant',
	lemon: 'eggplant',
	ginkgo: 'lettuce',
	maple: 'lettuce',
	pine: 'lettuce',
	tea: 'spinach',
	bamboo: 'scallion'
};

export function remapPlantId(id: string | null | undefined): VegId {
	if (!id) return 'tomato';
	return LEGACY_PLANT_MAP[id] ?? 'tomato';
}

export function isVegId(id: string): id is VegId {
	return (VEG_IDS as readonly string[]).includes(id);
}

export function plantById(id: string): PlantDef | undefined {
	return PLANTS.find((item) => item.id === id);
}

export function unlockedPlants(_harvests = 0): PlantDef[] {
	return PLANTS;
}

export function starterSeeds(): Record<string, number> {
	return Object.fromEntries(VEG_IDS.map((id) => [id, 1]));
}

export function remapSeedBag(seeds: Record<string, number>): Record<string, number> {
	const next: Record<string, number> = {};
	for (const [id, count] of Object.entries(seeds)) {
		if (count <= 0) continue;
		const veg = remapPlantId(id);
		next[veg] = (next[veg] ?? 0) + count;
	}
	return next;
}

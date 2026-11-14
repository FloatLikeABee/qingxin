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

function plant(
	id: string,
	name: string,
	water: Need,
	light: Need,
	nutrient: Need,
	unlockAt: number,
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
		stageTicks: 12,
		harvestValue,
		seedCost,
		unlockAt,
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
		0,
		14,
		8,
		{ stem: '#4d7c0f', leaf: '#65a30d', bloom: '#ef4444' },
		{
			family: 'fruiting',
			height: 1.4,
			stemCount: 2,
			leafShape: 'compound',
			leafCount: 8,
			bloomKind: 'cluster',
			fruitKind: 'berry'
		}
	),
	plant(
		'lettuce',
		'生菜',
		'high',
		'mid',
		'mid',
		0,
		10,
		6,
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
		'mint',
		'薄荷',
		'mid',
		'mid',
		'low',
		0,
		9,
		6,
		{ stem: '#166534', leaf: '#34d399', bloom: '#a7f3d0' },
		{
			family: 'herb',
			height: 0.45,
			stemCount: 4,
			leafShape: 'oval',
			leafCount: 16,
			bloomKind: 'spike',
			fruitKind: 'none'
		}
	),
	plant(
		'cucumber',
		'黄瓜',
		'high',
		'high',
		'mid',
		2,
		12,
		8,
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
		'chili',
		'辣椒',
		'low',
		'high',
		'mid',
		2,
		13,
		8,
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
		'eggplant',
		'茄子',
		'mid',
		'high',
		'high',
		3,
		15,
		9,
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
		'spinach',
		'菠菜',
		'high',
		'low',
		'mid',
		3,
		11,
		7,
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
		'cabbage',
		'白菜',
		'high',
		'mid',
		'high',
		4,
		12,
		8,
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
		'carrot',
		'胡萝卜',
		'mid',
		'high',
		'low',
		4,
		11,
		7,
		{ stem: '#3f6212', leaf: '#65a30d', bloom: '#f97316' },
		{
			family: 'rosette',
			height: 0.35,
			stemCount: 1,
			leafShape: 'lance',
			leafCount: 11,
			bloomKind: 'none',
			fruitKind: 'bulb'
		}
	),
	plant(
		'onion',
		'洋葱',
		'low',
		'high',
		'mid',
		5,
		10,
		7,
		{ stem: '#4d7c0f', leaf: '#86efac', bloom: '#e9d5ff' },
		{
			family: 'grass',
			height: 0.7,
			stemCount: 6,
			leafShape: 'lance',
			leafCount: 9,
			bloomKind: 'none',
			fruitKind: 'bulb'
		}
	),
	plant(
		'garlic',
		'大蒜',
		'low',
		'mid',
		'low',
		5,
		10,
		7,
		{ stem: '#4d7c0f', leaf: '#bbf7d0', bloom: '#f8fafc' },
		{
			family: 'grass',
			height: 0.65,
			stemCount: 5,
			leafShape: 'lance',
			leafCount: 8,
			bloomKind: 'spike',
			fruitKind: 'bulb'
		}
	),
	plant(
		'potato',
		'土豆',
		'mid',
		'mid',
		'high',
		6,
		13,
		8,
		{ stem: '#3f6212', leaf: '#65a30d', bloom: '#eab308' },
		{
			family: 'leafy',
			height: 0.6,
			stemCount: 2,
			leafShape: 'compound',
			leafCount: 10,
			bloomKind: 'cluster',
			fruitKind: 'none'
		}
	),
	plant(
		'strawberry',
		'草莓',
		'high',
		'high',
		'mid',
		6,
		16,
		10,
		{ stem: '#166534', leaf: '#22c55e', bloom: '#fb7185' },
		{
			family: 'fruiting',
			height: 0.35,
			stemCount: 1,
			leafShape: 'oval',
			leafCount: 12,
			bloomKind: 'cluster',
			fruitKind: 'berry'
		}
	),
	plant(
		'melon',
		'西瓜',
		'high',
		'high',
		'high',
		8,
		18,
		12,
		{ stem: '#3f6212', leaf: '#4d7c0f', bloom: '#14b8a6' },
		{
			family: 'vine',
			height: 0.7,
			stemCount: 1,
			leafShape: 'palmate',
			leafCount: 7,
			bloomKind: 'cup',
			fruitKind: 'gourd'
		}
	),
	plant(
		'pumpkin',
		'南瓜',
		'mid',
		'high',
		'high',
		8,
		17,
		11,
		{ stem: '#3f6212', leaf: '#65a30d', bloom: '#f59e0b' },
		{
			family: 'vine',
			height: 0.95,
			stemCount: 2,
			leafShape: 'palmate',
			leafCount: 5,
			bloomKind: 'cup',
			fruitKind: 'gourd'
		}
	),
	plant(
		'corn',
		'玉米',
		'mid',
		'high',
		'high',
		9,
		15,
		10,
		{ stem: '#4d7c0f', leaf: '#84cc16', bloom: '#facc15' },
		{
			family: 'grass',
			height: 1.6,
			stemCount: 1,
			leafShape: 'lance',
			leafCount: 8,
			bloomKind: 'none',
			fruitKind: 'ear'
		}
	),
	plant(
		'rice',
		'水稻',
		'high',
		'high',
		'mid',
		9,
		14,
		9,
		{ stem: '#65a30d', leaf: '#a3e635', bloom: '#fef9c3' },
		{
			family: 'grass',
			height: 0.9,
			stemCount: 8,
			leafShape: 'lance',
			leafCount: 20,
			bloomKind: 'spike',
			fruitKind: 'none'
		}
	),
	plant(
		'wheat',
		'小麦',
		'low',
		'high',
		'low',
		10,
		13,
		9,
		{ stem: '#a16207', leaf: '#ca8a04', bloom: '#facc15' },
		{
			family: 'grass',
			height: 1.0,
			stemCount: 10,
			leafShape: 'lance',
			leafCount: 16,
			bloomKind: 'spike',
			fruitKind: 'none'
		}
	),
	plant(
		'sunflower',
		'向日葵',
		'mid',
		'high',
		'mid',
		10,
		16,
		10,
		{ stem: '#3f6212', leaf: '#4d7c0f', bloom: '#eab308' },
		{
			family: 'flower',
			height: 1.7,
			stemCount: 1,
			leafShape: 'palmate',
			leafCount: 8,
			bloomKind: 'disc',
			fruitKind: 'none'
		}
	),
	plant(
		'basil',
		'罗勒',
		'mid',
		'mid',
		'mid',
		11,
		11,
		7,
		{ stem: '#14532d', leaf: '#15803d', bloom: '#4ade80' },
		{
			family: 'herb',
			height: 0.5,
			stemCount: 3,
			leafShape: 'oval',
			leafCount: 12,
			bloomKind: 'cluster',
			fruitKind: 'none'
		}
	),
	plant(
		'rosemary',
		'迷迭香',
		'low',
		'high',
		'low',
		11,
		12,
		8,
		{ stem: '#365314', leaf: '#3f6212', bloom: '#a3e635' },
		{
			family: 'herb',
			height: 0.55,
			stemCount: 3,
			leafShape: 'needle',
			leafCount: 20,
			bloomKind: 'spike',
			fruitKind: 'none'
		}
	),
	plant(
		'lavender',
		'薰衣草',
		'low',
		'high',
		'low',
		12,
		15,
		10,
		{ stem: '#4d7c0f', leaf: '#65a30d', bloom: '#a78bfa' },
		{
			family: 'herb',
			height: 0.8,
			stemCount: 5,
			leafShape: 'lance',
			leafCount: 18,
			bloomKind: 'spike',
			fruitKind: 'none'
		}
	),
	plant(
		'rose',
		'玫瑰',
		'mid',
		'high',
		'mid',
		12,
		18,
		12,
		{ stem: '#365314', leaf: '#4d7c0f', bloom: '#f43f5e' },
		{
			family: 'flower',
			height: 0.95,
			stemCount: 3,
			leafShape: 'compound',
			leafCount: 9,
			bloomKind: 'cup',
			fruitKind: 'none'
		}
	),
	plant(
		'peony',
		'牡丹',
		'mid',
		'mid',
		'high',
		14,
		20,
		13,
		{ stem: '#3f6212', leaf: '#65a30d', bloom: '#fb7185' },
		{
			family: 'flower',
			height: 0.8,
			stemCount: 2,
			leafShape: 'palmate',
			leafCount: 10,
			bloomKind: 'cup',
			fruitKind: 'none'
		}
	),
	plant(
		'chrysanthemum',
		'菊花',
		'mid',
		'high',
		'mid',
		14,
		16,
		10,
		{ stem: '#4d7c0f', leaf: '#84cc16', bloom: '#fde68a' },
		{
			family: 'flower',
			height: 0.7,
			stemCount: 1,
			leafShape: 'palmate',
			leafCount: 14,
			bloomKind: 'disc',
			fruitKind: 'cluster'
		}
	),
	plant(
		'orchid',
		'兰花',
		'mid',
		'low',
		'low',
		16,
		19,
		14,
		{ stem: '#365314', leaf: '#166534', bloom: '#c4b5fd' },
		{
			family: 'flower',
			height: 0.6,
			stemCount: 1,
			leafShape: 'lance',
			leafCount: 4,
			bloomKind: 'star',
			fruitKind: 'none'
		}
	),
	plant(
		'lotus',
		'荷花',
		'high',
		'high',
		'mid',
		16,
		18,
		13,
		{ stem: '#365314', leaf: '#15803d', bloom: '#fda4af' },
		{
			family: 'aquatic',
			height: 0.5,
			stemCount: 1,
			leafShape: 'round',
			leafCount: 5,
			bloomKind: 'cup',
			fruitKind: 'none'
		}
	),
	plant(
		'lily',
		'百合',
		'mid',
		'mid',
		'mid',
		17,
		17,
		12,
		{ stem: '#4d7c0f', leaf: '#65a30d', bloom: '#fef3c7' },
		{
			family: 'flower',
			height: 0.9,
			stemCount: 1,
			leafShape: 'lance',
			leafCount: 6,
			bloomKind: 'bell',
			fruitKind: 'none'
		}
	),
	plant(
		'bamboo',
		'竹子',
		'high',
		'mid',
		'low',
		17,
		14,
		10,
		{ stem: '#166534', leaf: '#22c55e', bloom: '#86efac' },
		{
			family: 'grass',
			height: 1.8,
			stemCount: 4,
			leafShape: 'lance',
			leafCount: 12,
			bloomKind: 'none',
			fruitKind: 'none'
		}
	),
	plant(
		'pine',
		'松树',
		'low',
		'mid',
		'low',
		18,
		15,
		11,
		{ stem: '#3f3f32', leaf: '#365314', bloom: '#a8a29e' },
		{
			family: 'tree',
			height: 1.6,
			stemCount: 1,
			leafShape: 'needle',
			leafCount: 24,
			bloomKind: 'none',
			fruitKind: 'none'
		}
	),
	plant(
		'ginkgo',
		'银杏',
		'mid',
		'mid',
		'low',
		18,
		16,
		12,
		{ stem: '#78350f', leaf: '#eab308', bloom: '#fde68a' },
		{
			family: 'tree',
			height: 1.5,
			stemCount: 1,
			leafShape: 'palmate',
			leafCount: 12,
			bloomKind: 'none',
			fruitKind: 'none'
		}
	),
	plant(
		'maple',
		'枫树',
		'mid',
		'mid',
		'mid',
		20,
		16,
		12,
		{ stem: '#7c2d12', leaf: '#ea580c', bloom: '#fb923c' },
		{
			family: 'tree',
			height: 1.45,
			stemCount: 1,
			leafShape: 'palmate',
			leafCount: 10,
			bloomKind: 'none',
			fruitKind: 'none'
		}
	),
	plant(
		'cactus',
		'仙人掌',
		'low',
		'high',
		'low',
		20,
		13,
		9,
		{ stem: '#166534', leaf: '#15803d', bloom: '#fb7185' },
		{
			family: 'succulent',
			height: 0.7,
			stemCount: 1,
			leafShape: 'oval',
			leafCount: 6,
			bloomKind: 'cup',
			fruitKind: 'berry'
		}
	),
	plant(
		'aloe',
		'芦荟',
		'low',
		'high',
		'low',
		21,
		12,
		9,
		{ stem: '#14532d', leaf: '#4ade80', bloom: '#bbf7d0' },
		{
			family: 'succulent',
			height: 0.55,
			stemCount: 1,
			leafShape: 'lance',
			leafCount: 8,
			bloomKind: 'none',
			fruitKind: 'none'
		}
	),
	plant(
		'succulent',
		'石莲',
		'low',
		'high',
		'low',
		21,
		12,
		9,
		{ stem: '#166534', leaf: '#99f6e4', bloom: '#5eead4' },
		{
			family: 'succulent',
			height: 0.3,
			stemCount: 1,
			leafShape: 'round',
			leafCount: 10,
			bloomKind: 'none',
			fruitKind: 'none'
		}
	),
	plant(
		'fern',
		'肾蕨',
		'high',
		'low',
		'mid',
		22,
		11,
		8,
		{ stem: '#14532d', leaf: '#16a34a', bloom: '#86efac' },
		{
			family: 'leafy',
			height: 0.65,
			stemCount: 1,
			leafShape: 'frond',
			leafCount: 9,
			bloomKind: 'none',
			fruitKind: 'none'
		}
	),
	plant(
		'moss',
		'苔藓',
		'high',
		'low',
		'low',
		22,
		8,
		6,
		{ stem: '#14532d', leaf: '#4d7c0f', bloom: '#65a30d' },
		{
			family: 'rosette',
			height: 0.12,
			stemCount: 1,
			leafShape: 'round',
			leafCount: 20,
			bloomKind: 'none',
			fruitKind: 'none'
		}
	),
	plant(
		'grape',
		'葡萄',
		'mid',
		'high',
		'mid',
		24,
		18,
		13,
		{ stem: '#3f6212', leaf: '#4d7c0f', bloom: '#6d28d9' },
		{
			family: 'vine',
			height: 1.2,
			stemCount: 1,
			leafShape: 'heart',
			leafCount: 8,
			bloomKind: 'cluster',
			fruitKind: 'berry'
		}
	),
	plant(
		'apple',
		'苹果',
		'mid',
		'high',
		'mid',
		24,
		17,
		12,
		{ stem: '#3f6212', leaf: '#65a30d', bloom: '#ef4444' },
		{
			family: 'tree',
			height: 1.55,
			stemCount: 1,
			leafShape: 'oval',
			leafCount: 10,
			bloomKind: 'cup',
			fruitKind: 'drupe'
		}
	),
	plant(
		'lemon',
		'柠檬',
		'mid',
		'high',
		'low',
		26,
		16,
		11,
		{ stem: '#3f6212', leaf: '#84cc16', bloom: '#facc15' },
		{
			family: 'tree',
			height: 1.35,
			stemCount: 1,
			leafShape: 'oval',
			leafCount: 8,
			bloomKind: 'cup',
			fruitKind: 'drupe'
		}
	),
	plant(
		'tea',
		'茶树',
		'mid',
		'mid',
		'low',
		26,
		15,
		11,
		{ stem: '#365314', leaf: '#166534', bloom: '#fef9c3' },
		{
			family: 'tree',
			height: 1.1,
			stemCount: 1,
			leafShape: 'oval',
			leafCount: 16,
			bloomKind: 'cluster',
			fruitKind: 'none'
		}
	),
	plant(
		'jasmine',
		'茉莉',
		'mid',
		'mid',
		'low',
		28,
		16,
		12,
		{ stem: '#3f6212', leaf: '#4d7c0f', bloom: '#f8fafc' },
		{
			family: 'flower',
			height: 0.85,
			stemCount: 2,
			leafShape: 'heart',
			leafCount: 11,
			bloomKind: 'cluster',
			fruitKind: 'none'
		}
	),
	plant(
		'bokchoy',
		'小白菜',
		'high',
		'mid',
		'mid',
		3,
		11,
		7,
		{ stem: '#4d7c0f', leaf: '#bbf7d0', bloom: '#f8fafc' },
		{
			family: 'leafy',
			height: 0.42,
			stemCount: 1,
			leafShape: 'oval',
			leafCount: 11,
			bloomKind: 'none',
			fruitKind: 'head'
		}
	),
	plant(
		'kale',
		'羽衣甘蓝',
		'mid',
		'mid',
		'high',
		7,
		13,
		8,
		{ stem: '#14532d', leaf: '#166534', bloom: '#4ade80' },
		{
			family: 'leafy',
			height: 0.58,
			stemCount: 1,
			leafShape: 'palmate',
			leafCount: 9,
			bloomKind: 'none',
			fruitKind: 'none'
		}
	),
	plant(
		'celery',
		'芹菜',
		'high',
		'mid',
		'mid',
		8,
		12,
		8,
		{ stem: '#65a30d', leaf: '#86efac', bloom: '#bbf7d0' },
		{
			family: 'herb',
			height: 0.75,
			stemCount: 6,
			leafShape: 'lance',
			leafCount: 14,
			bloomKind: 'none',
			fruitKind: 'none'
		}
	),
	plant(
		'parsley',
		'香芹',
		'mid',
		'mid',
		'low',
		9,
		11,
		7,
		{ stem: '#166534', leaf: '#22c55e', bloom: '#86efac' },
		{
			family: 'herb',
			height: 0.4,
			stemCount: 1,
			leafShape: 'compound',
			leafCount: 15,
			bloomKind: 'none',
			fruitKind: 'none'
		}
	),
	plant(
		'thyme',
		'百里香',
		'low',
		'high',
		'low',
		13,
		12,
		8,
		{ stem: '#365314', leaf: '#4d7c0f', bloom: '#fde68a' },
		{
			family: 'herb',
			height: 0.28,
			stemCount: 8,
			leafShape: 'oval',
			leafCount: 22,
			bloomKind: 'spike',
			fruitKind: 'none'
		}
	),
	plant(
		'sage',
		'鼠尾草',
		'low',
		'high',
		'low',
		13,
		13,
		8,
		{ stem: '#3f6212', leaf: '#84cc16', bloom: '#c4b5fd' },
		{
			family: 'herb',
			height: 0.62,
			stemCount: 2,
			leafShape: 'oval',
			leafCount: 10,
			bloomKind: 'spike',
			fruitKind: 'none'
		}
	),
	plant(
		'coriander',
		'香菜',
		'mid',
		'mid',
		'low',
		10,
		10,
		7,
		{ stem: '#4d7c0f', leaf: '#86efac', bloom: '#fef9c3' },
		{
			family: 'herb',
			height: 0.45,
			stemCount: 1,
			leafShape: 'compound',
			leafCount: 13,
			bloomKind: 'umbrella',
			fruitKind: 'none'
		}
	),
	plant(
		'daisy',
		'雏菊',
		'mid',
		'high',
		'low',
		15,
		14,
		9,
		{ stem: '#4d7c0f', leaf: '#65a30d', bloom: '#f8fafc' },
		{
			family: 'flower',
			height: 0.5,
			stemCount: 1,
			leafShape: 'oval',
			leafCount: 8,
			bloomKind: 'disc',
			fruitKind: 'none'
		}
	),
	plant(
		'tulip',
		'郁金香',
		'mid',
		'high',
		'mid',
		15,
		16,
		10,
		{ stem: '#365314', leaf: '#4d7c0f', bloom: '#fb7185' },
		{
			family: 'flower',
			height: 0.7,
			stemCount: 1,
			leafShape: 'lance',
			leafCount: 3,
			bloomKind: 'cup',
			fruitKind: 'none'
		}
	),
	plant(
		'hibiscus',
		'扶桑',
		'mid',
		'high',
		'mid',
		19,
		17,
		12,
		{ stem: '#3f6212', leaf: '#16a34a', bloom: '#f43f5e' },
		{
			family: 'flower',
			height: 1.2,
			stemCount: 1,
			leafShape: 'palmate',
			leafCount: 6,
			bloomKind: 'star',
			fruitKind: 'none'
		}
	),
	plant(
		'marigold',
		'万寿菊',
		'low',
		'high',
		'mid',
		15,
		14,
		9,
		{ stem: '#4d7c0f', leaf: '#84cc16', bloom: '#f97316' },
		{
			family: 'flower',
			height: 0.48,
			stemCount: 1,
			leafShape: 'palmate',
			leafCount: 7,
			bloomKind: 'disc',
			fruitKind: 'none'
		}
	),
	plant(
		'morningglory',
		'牵牛',
		'mid',
		'high',
		'low',
		19,
		15,
		10,
		{ stem: '#3f6212', leaf: '#22c55e', bloom: '#818cf8' },
		{
			family: 'vine',
			height: 1.0,
			stemCount: 1,
			leafShape: 'heart',
			leafCount: 9,
			bloomKind: 'star',
			fruitKind: 'none'
		}
	),
	plant(
		'pea',
		'豌豆',
		'mid',
		'mid',
		'mid',
		11,
		13,
		8,
		{ stem: '#4d7c0f', leaf: '#65a30d', bloom: '#f8fafc' },
		{
			family: 'vine',
			height: 0.9,
			stemCount: 1,
			leafShape: 'compound',
			leafCount: 8,
			bloomKind: 'bell',
			fruitKind: 'pod'
		}
	),
	plant(
		'bean',
		'豇豆',
		'mid',
		'high',
		'mid',
		12,
		14,
		9,
		{ stem: '#365314', leaf: '#4d7c0f', bloom: '#86efac' },
		{
			family: 'vine',
			height: 1.15,
			stemCount: 1,
			leafShape: 'compound',
			leafCount: 7,
			bloomKind: 'cluster',
			fruitKind: 'pod'
		}
	),
	plant(
		'zucchini',
		'西葫芦',
		'high',
		'high',
		'high',
		14,
		16,
		10,
		{ stem: '#3f6212', leaf: '#65a30d', bloom: '#fde68a' },
		{
			family: 'vine',
			height: 0.6,
			stemCount: 1,
			leafShape: 'palmate',
			leafCount: 8,
			bloomKind: 'cup',
			fruitKind: 'gourd'
		}
	),
	plant(
		'blueberry',
		'蓝莓',
		'high',
		'mid',
		'mid',
		21,
		17,
		12,
		{ stem: '#365314', leaf: '#166534', bloom: '#6366f1' },
		{
			family: 'fruiting',
			height: 0.75,
			stemCount: 3,
			leafShape: 'oval',
			leafCount: 14,
			bloomKind: 'cluster',
			fruitKind: 'berry'
		}
	),
	plant(
		'radish',
		'萝卜',
		'mid',
		'high',
		'low',
		6,
		11,
		7,
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
		'pear',
		'香梨',
		'mid',
		'high',
		'mid',
		27,
		18,
		13,
		{ stem: '#78350f', leaf: '#65a30d', bloom: '#fef9c3' },
		{
			family: 'tree',
			height: 1.5,
			stemCount: 1,
			leafShape: 'oval',
			leafCount: 9,
			bloomKind: 'cup',
			fruitKind: 'drupe'
		}
	),
	plant(
		'peach',
		'桃树',
		'mid',
		'high',
		'mid',
		27,
		18,
		13,
		{ stem: '#7c2d12', leaf: '#4d7c0f', bloom: '#fb7185' },
		{
			family: 'tree',
			height: 1.4,
			stemCount: 1,
			leafShape: 'heart',
			leafCount: 8,
			bloomKind: 'cup',
			fruitKind: 'drupe'
		}
	),
	plant(
		'papyrus',
		'纸莎草',
		'high',
		'high',
		'low',
		23,
		13,
		9,
		{ stem: '#a16207', leaf: '#84cc16', bloom: '#fef9c3' },
		{
			family: 'aquatic',
			height: 1.3,
			stemCount: 7,
			leafShape: 'lance',
			leafCount: 18,
			bloomKind: 'none',
			fruitKind: 'none'
		}
	),
	plant(
		'echeveria',
		'玉露',
		'low',
		'high',
		'low',
		23,
		12,
		9,
		{ stem: '#166534', leaf: '#5eead4', bloom: '#fda4af' },
		{
			family: 'succulent',
			height: 0.22,
			stemCount: 1,
			leafShape: 'round',
			leafCount: 16,
			bloomKind: 'none',
			fruitKind: 'none'
		}
	),
	plant(
		'persimmon',
		'柿子',
		'mid',
		'high',
		'mid',
		29,
		19,
		13,
		{ stem: '#7c2d12', leaf: '#65a30d', bloom: '#f97316' },
		{
			family: 'tree',
			height: 1.48,
			stemCount: 1,
			leafShape: 'oval',
			leafCount: 7,
			bloomKind: 'none',
			fruitKind: 'drupe'
		}
	)
];

export function plantById(id: string): PlantDef | undefined {
	return PLANTS.find((item) => item.id === id);
}

export function unlockedPlants(harvests: number): PlantDef[] {
	return PLANTS.filter((item) => item.unlockAt <= harvests);
}

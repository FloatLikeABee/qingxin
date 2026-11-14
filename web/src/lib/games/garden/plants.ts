export type Need = 'low' | 'mid' | 'high';

export type PlantForm =
	| 'tomato'
	| 'cucumber'
	| 'chili'
	| 'eggplant'
	| 'lettuce'
	| 'spinach'
	| 'cabbage'
	| 'carrot'
	| 'onion'
	| 'garlic'
	| 'potato'
	| 'strawberry'
	| 'melon'
	| 'pumpkin'
	| 'corn'
	| 'rice'
	| 'wheat'
	| 'sunflower'
	| 'mint'
	| 'basil'
	| 'rosemary'
	| 'lavender'
	| 'rose'
	| 'peony'
	| 'chrysanthemum'
	| 'orchid'
	| 'lotus'
	| 'lily'
	| 'bamboo'
	| 'pine'
	| 'ginkgo'
	| 'maple'
	| 'cactus'
	| 'aloe'
	| 'succulent'
	| 'fern'
	| 'moss'
	| 'grape'
	| 'apple'
	| 'lemon'
	| 'tea'
	| 'jasmine';

export interface PlantDef {
	id: string;
	name: string;
	form: PlantForm;
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
	form: PlantForm,
	name: string,
	water: Need,
	light: Need,
	nutrient: Need,
	unlockAt: number,
	harvestValue: number,
	seedCost: number,
	palette: PlantDef['palette']
): PlantDef {
	return {
		id: form,
		name,
		form,
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
	plant('tomato', '番茄', 'mid', 'high', 'mid', 0, 14, 8, {
		stem: '#4d7c0f',
		leaf: '#65a30d',
		bloom: '#ef4444'
	}),
	plant('lettuce', '生菜', 'high', 'mid', 'mid', 0, 10, 6, {
		stem: '#4d7c0f',
		leaf: '#86efac',
		bloom: '#bbf7d0'
	}),
	plant('mint', '薄荷', 'mid', 'mid', 'low', 0, 9, 6, {
		stem: '#166534',
		leaf: '#34d399',
		bloom: '#a7f3d0'
	}),
	plant('cucumber', '黄瓜', 'high', 'high', 'mid', 2, 12, 8, {
		stem: '#3f6212',
		leaf: '#4d7c0f',
		bloom: '#22c55e'
	}),
	plant('chili', '辣椒', 'low', 'high', 'mid', 2, 13, 8, {
		stem: '#365314',
		leaf: '#4d7c0f',
		bloom: '#f97316'
	}),
	plant('eggplant', '茄子', 'mid', 'high', 'high', 3, 15, 9, {
		stem: '#3f6212',
		leaf: '#65a30d',
		bloom: '#7c3aed'
	}),
	plant('spinach', '菠菜', 'high', 'low', 'mid', 3, 11, 7, {
		stem: '#14532d',
		leaf: '#166534',
		bloom: '#15803d'
	}),
	plant('cabbage', '白菜', 'high', 'mid', 'high', 4, 12, 8, {
		stem: '#4d7c0f',
		leaf: '#ecfccb',
		bloom: '#d9f99d'
	}),
	plant('carrot', '胡萝卜', 'mid', 'high', 'low', 4, 11, 7, {
		stem: '#3f6212',
		leaf: '#65a30d',
		bloom: '#f97316'
	}),
	plant('onion', '洋葱', 'low', 'high', 'mid', 5, 10, 7, {
		stem: '#4d7c0f',
		leaf: '#86efac',
		bloom: '#e9d5ff'
	}),
	plant('garlic', '大蒜', 'low', 'mid', 'low', 5, 10, 7, {
		stem: '#4d7c0f',
		leaf: '#bbf7d0',
		bloom: '#f8fafc'
	}),
	plant('potato', '土豆', 'mid', 'mid', 'high', 6, 13, 8, {
		stem: '#3f6212',
		leaf: '#65a30d',
		bloom: '#eab308'
	}),
	plant('strawberry', '草莓', 'high', 'high', 'mid', 6, 16, 10, {
		stem: '#166534',
		leaf: '#22c55e',
		bloom: '#fb7185'
	}),
	plant('melon', '西瓜', 'high', 'high', 'high', 8, 18, 12, {
		stem: '#3f6212',
		leaf: '#4d7c0f',
		bloom: '#14b8a6'
	}),
	plant('pumpkin', '南瓜', 'mid', 'high', 'high', 8, 17, 11, {
		stem: '#3f6212',
		leaf: '#65a30d',
		bloom: '#f59e0b'
	}),
	plant('corn', '玉米', 'mid', 'high', 'high', 9, 15, 10, {
		stem: '#4d7c0f',
		leaf: '#84cc16',
		bloom: '#facc15'
	}),
	plant('rice', '水稻', 'high', 'high', 'mid', 9, 14, 9, {
		stem: '#65a30d',
		leaf: '#a3e635',
		bloom: '#fef9c3'
	}),
	plant('wheat', '小麦', 'low', 'high', 'low', 10, 13, 9, {
		stem: '#a16207',
		leaf: '#ca8a04',
		bloom: '#facc15'
	}),
	plant('sunflower', '向日葵', 'mid', 'high', 'mid', 10, 16, 10, {
		stem: '#3f6212',
		leaf: '#4d7c0f',
		bloom: '#eab308'
	}),
	plant('basil', '罗勒', 'mid', 'mid', 'mid', 11, 11, 7, {
		stem: '#14532d',
		leaf: '#15803d',
		bloom: '#4ade80'
	}),
	plant('rosemary', '迷迭香', 'low', 'high', 'low', 11, 12, 8, {
		stem: '#365314',
		leaf: '#3f6212',
		bloom: '#a3e635'
	}),
	plant('lavender', '薰衣草', 'low', 'high', 'low', 12, 15, 10, {
		stem: '#4d7c0f',
		leaf: '#65a30d',
		bloom: '#a78bfa'
	}),
	plant('rose', '玫瑰', 'mid', 'high', 'mid', 12, 18, 12, {
		stem: '#365314',
		leaf: '#4d7c0f',
		bloom: '#f43f5e'
	}),
	plant('peony', '牡丹', 'mid', 'mid', 'high', 14, 20, 13, {
		stem: '#3f6212',
		leaf: '#65a30d',
		bloom: '#fb7185'
	}),
	plant('chrysanthemum', '菊花', 'mid', 'high', 'mid', 14, 16, 10, {
		stem: '#4d7c0f',
		leaf: '#84cc16',
		bloom: '#fde68a'
	}),
	plant('orchid', '兰花', 'mid', 'low', 'low', 16, 19, 14, {
		stem: '#365314',
		leaf: '#166534',
		bloom: '#c4b5fd'
	}),
	plant('lotus', '荷花', 'high', 'high', 'mid', 16, 18, 13, {
		stem: '#365314',
		leaf: '#15803d',
		bloom: '#fda4af'
	}),
	plant('lily', '百合', 'mid', 'mid', 'mid', 17, 17, 12, {
		stem: '#4d7c0f',
		leaf: '#65a30d',
		bloom: '#fef3c7'
	}),
	plant('bamboo', '竹子', 'high', 'mid', 'low', 17, 14, 10, {
		stem: '#166534',
		leaf: '#22c55e',
		bloom: '#86efac'
	}),
	plant('pine', '松树', 'low', 'mid', 'low', 18, 15, 11, {
		stem: '#3f3f32',
		leaf: '#365314',
		bloom: '#a8a29e'
	}),
	plant('ginkgo', '银杏', 'mid', 'mid', 'low', 18, 16, 12, {
		stem: '#78350f',
		leaf: '#eab308',
		bloom: '#fde68a'
	}),
	plant('maple', '枫树', 'mid', 'mid', 'mid', 20, 16, 12, {
		stem: '#7c2d12',
		leaf: '#ea580c',
		bloom: '#fb923c'
	}),
	plant('cactus', '仙人掌', 'low', 'high', 'low', 20, 13, 9, {
		stem: '#166534',
		leaf: '#15803d',
		bloom: '#fb7185'
	}),
	plant('aloe', '芦荟', 'low', 'high', 'low', 21, 12, 9, {
		stem: '#14532d',
		leaf: '#4ade80',
		bloom: '#bbf7d0'
	}),
	plant('succulent', '石莲', 'low', 'high', 'low', 21, 12, 9, {
		stem: '#166534',
		leaf: '#99f6e4',
		bloom: '#5eead4'
	}),
	plant('fern', '肾蕨', 'high', 'low', 'mid', 22, 11, 8, {
		stem: '#14532d',
		leaf: '#16a34a',
		bloom: '#86efac'
	}),
	plant('moss', '苔藓', 'high', 'low', 'low', 22, 8, 6, {
		stem: '#14532d',
		leaf: '#4d7c0f',
		bloom: '#65a30d'
	}),
	plant('grape', '葡萄', 'mid', 'high', 'mid', 24, 18, 13, {
		stem: '#3f6212',
		leaf: '#4d7c0f',
		bloom: '#6d28d9'
	}),
	plant('apple', '苹果', 'mid', 'high', 'mid', 24, 17, 12, {
		stem: '#3f6212',
		leaf: '#65a30d',
		bloom: '#ef4444'
	}),
	plant('lemon', '柠檬', 'mid', 'high', 'low', 26, 16, 11, {
		stem: '#3f6212',
		leaf: '#84cc16',
		bloom: '#facc15'
	}),
	plant('tea', '茶树', 'mid', 'mid', 'low', 26, 15, 11, {
		stem: '#365314',
		leaf: '#166534',
		bloom: '#fef9c3'
	}),
	plant('jasmine', '茉莉', 'mid', 'mid', 'low', 28, 16, 12, {
		stem: '#3f6212',
		leaf: '#4d7c0f',
		bloom: '#f8fafc'
	})
];

export function plantById(id: string): PlantDef | undefined {
	return PLANTS.find((plant) => plant.id === id);
}

export function unlockedPlants(harvests: number): PlantDef[] {
	return PLANTS.filter((plant) => plant.unlockAt <= harvests);
}

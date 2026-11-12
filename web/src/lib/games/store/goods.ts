export const SKUS = ['water', 'bread', 'milk', 'snacks', 'bento'] as const;
export type SkuId = (typeof SKUS)[number];

export interface GoodsDef {
	id: SkuId;
	name: string;
	price: number;
	crateCost: number;
	crateSize: number;
	color: string;
}

export const GOODS: Record<SkuId, GoodsDef> = {
	water: { id: 'water', name: '矿泉水', price: 3, crateCost: 8, crateSize: 8, color: '#3B82F6' },
	bread: { id: 'bread', name: '吐司', price: 6, crateCost: 14, crateSize: 6, color: '#EAB308' },
	milk: { id: 'milk', name: '鲜奶', price: 8, crateCost: 18, crateSize: 6, color: '#14B8A6' },
	snacks: { id: 'snacks', name: '零食', price: 5, crateCost: 12, crateSize: 8, color: '#F97316' },
	bento: { id: 'bento', name: '便当', price: 16, crateCost: 28, crateSize: 4, color: '#C45C6A' }
};

export function emptyStock(): Record<SkuId, number> {
	return { water: 0, bread: 0, milk: 0, snacks: 0, bento: 0 };
}

export function totalUnits(stock: Record<SkuId, number>): number {
	return SKUS.reduce((sum, sku) => sum + stock[sku], 0);
}

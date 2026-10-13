export const CATEGORIES = ['维修', '宠物', '配送', '适老'] as const;
export type LocalCategory = (typeof CATEGORIES)[number];

export const ELDER_TAGS = ['有坡道', '大字菜单', '耐心服务'] as const;
export type ElderTag = (typeof ELDER_TAGS)[number];

export const CORRECTION_KINDS = ['已搬迁', '电话空号'] as const;
export type CorrectionKind = (typeof CORRECTION_KINDS)[number];

export const HERO_KEYS = ['pet', 'repair', 'delivery', 'elder'] as const;
export type HeroKey = (typeof HERO_KEYS)[number];

export const COMMUNITY_ORIGIN = {
	lat: 31.230416,
	lng: 121.473701,
	name: '轻心社区'
} as const;

export interface LocalService {
	id: string;
	name: string;
	category: LocalCategory;
	latitude: number;
	longitude: number;
	address: string;
	tags: ElderTag[];
	ratingAvg: number;
	hours?: string | null;
	phone?: string | null;
	heroKey?: HeroKey | null;
	createdAt?: string;
	createdBy?: string | null;
	distanceM?: number;
	correctionCounts?: Record<CorrectionKind, number>;
}

export interface LocalReview {
	id: string;
	serviceId: string;
	userId: string;
	content: string;
	rating?: number | null;
	images?: string[];
	createdAt: string;
}

export interface LocalCorrection {
	id: string;
	serviceId: string;
	userId: string;
	kind: CorrectionKind;
	createdAt: string;
}

export const SEED_SERVICES: LocalService[] = [
	{
		id: 'a1e1c0de-0001-4000-8000-000000000001',
		name: '轻心宠物医院',
		category: '宠物',
		latitude: 31.2318,
		longitude: 121.4754,
		address: '静安区轻心路 12 号',
		tags: ['有坡道', '耐心服务'],
		ratingAvg: 4.8,
		hours: '09:00–21:00',
		phone: '021-5555-0101',
		heroKey: 'pet',
		createdAt: '2026-10-01T02:00:00Z'
	},
	{
		id: 'a1e1c0de-0001-4000-8000-000000000002',
		name: '暖光家电维修',
		category: '维修',
		latitude: 31.2299,
		longitude: 121.4721,
		address: '静安区梧桐巷 6 号',
		tags: ['耐心服务'],
		ratingAvg: 4.6,
		hours: '08:30–18:30',
		phone: '021-5555-0102',
		heroKey: 'repair',
		createdAt: '2026-10-01T02:00:00Z'
	},
	{
		id: 'a1e1c0de-0001-4000-8000-000000000003',
		name: '社区配送站',
		category: '配送',
		latitude: 31.2309,
		longitude: 121.4748,
		address: '静安区轻心路 28 号',
		tags: [],
		ratingAvg: 4.4,
		hours: '07:00–22:00',
		phone: '021-5555-0103',
		heroKey: 'delivery',
		createdAt: '2026-10-01T02:00:00Z'
	},
	{
		id: 'a1e1c0de-0001-4000-8000-000000000004',
		name: '慢行食堂',
		category: '适老',
		latitude: 31.2294,
		longitude: 121.4739,
		address: '静安区银杏街 3 号',
		tags: ['有坡道', '大字菜单', '耐心服务'],
		ratingAvg: 4.9,
		hours: '07:00–19:30',
		phone: '021-5555-0104',
		heroKey: 'elder',
		createdAt: '2026-10-01T02:00:00Z'
	},
	{
		id: 'a1e1c0de-0001-4000-8000-000000000005',
		name: '毛孩子洗护',
		category: '宠物',
		latitude: 31.2321,
		longitude: 121.4728,
		address: '静安区轻心路 41 号',
		tags: ['耐心服务'],
		ratingAvg: 4.5,
		hours: '10:00–20:00',
		phone: '021-5555-0105',
		heroKey: 'pet',
		createdAt: '2026-10-01T02:00:00Z'
	},
	{
		id: 'a1e1c0de-0001-4000-8000-000000000006',
		name: '夕阳配餐',
		category: '配送',
		latitude: 31.2288,
		longitude: 121.475,
		address: '静安区银杏街 15 号',
		tags: ['大字菜单', '耐心服务'],
		ratingAvg: 4.7,
		hours: '10:00–18:00',
		phone: '021-5555-0106',
		heroKey: 'delivery',
		createdAt: '2026-10-01T02:00:00Z'
	},
	{
		id: 'a1e1c0de-0001-4000-8000-000000000007',
		name: '银发理发屋',
		category: '适老',
		latitude: 31.2312,
		longitude: 121.4719,
		address: '静安区梧桐巷 19 号',
		tags: ['有坡道', '大字菜单'],
		ratingAvg: 4.7,
		hours: '09:00–18:00',
		phone: '021-5555-0107',
		heroKey: 'elder',
		createdAt: '2026-10-01T02:00:00Z'
	},
	{
		id: 'a1e1c0de-0001-4000-8000-000000000008',
		name: '钥匙应急铺',
		category: '维修',
		latitude: 31.2301,
		longitude: 121.476,
		address: '静安区轻心路 55 号',
		tags: [],
		ratingAvg: 4.3,
		hours: '00:00–24:00',
		phone: '021-5555-0108',
		heroKey: 'repair',
		createdAt: '2026-10-01T02:00:00Z'
	}
];

export const SEED_REVIEWS: LocalReview[] = [
	{
		id: 'rev-pet-1',
		serviceId: 'a1e1c0de-0001-4000-8000-000000000001',
		userId: 'user-demo',
		content: '医生把猫安抚得很好，候诊也有坡道。',
		rating: 5,
		createdAt: '2026-10-08T04:00:00Z'
	},
	{
		id: 'rev-elder-1',
		serviceId: 'a1e1c0de-0001-4000-8000-000000000004',
		userId: 'user-demo',
		content: '菜单字很大，上菜不催。',
		rating: 5,
		createdAt: '2026-10-09T06:00:00Z'
	}
];

export function categoryIcon(category: LocalCategory): string {
	if (category === '宠物') return 'paw';
	if (category === '维修') return 'kit';
	if (category === '配送') return 'briefcase';
	return 'heart';
}

export function defaultHero(category: LocalCategory): HeroKey {
	if (category === '宠物') return 'pet';
	if (category === '维修') return 'repair';
	if (category === '配送') return 'delivery';
	return 'elder';
}

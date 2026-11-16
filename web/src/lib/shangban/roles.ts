export type FloorId = 1 | 2 | 3 | 4 | 5;
export type RoleId = 'courier' | 'sales' | 'tech' | 'engineer' | 'finance' | 'manager' | 'ceo';
export type TaskKind = 'sort' | 'negotiate' | 'repair' | 'ship' | 'audit' | 'allocate' | 'decide';
export type Collar = 'blue' | 'white' | 'specialist-blue' | 'specialist-white' | 'manager' | 'ceo';

export interface RoleLook {
	body: number;
	accent: number;
	hat: boolean;
	tie: boolean;
}

export interface RoleDef {
	id: RoleId;
	name: string;
	collar: Collar;
	floor: FloorId;
	department: string;
	kind: TaskKind;
	look: RoleLook;
	blurb: string;
	selectable: true;
}

export const ROLES: RoleDef[] = [
	{
		id: 'courier',
		name: '物流员',
		collar: 'blue',
		floor: 1,
		department: '后勤与物流',
		kind: 'sort',
		look: { body: 0xf97316, accent: 0x0f766e, hat: true, tie: false },
		blurb: '从到货口提起包裹，放到对上的 A / B / C 口。',
		selectable: true
	},
	{
		id: 'sales',
		name: '销售顾问',
		collar: 'white',
		floor: 2,
		department: '客户与销售',
		kind: 'negotiate',
		look: { body: 0xe7eef8, accent: 0x3b82f6, hat: false, tie: true },
		blurb: '看对方耐心，报高价、公道价或让价。',
		selectable: true
	},
	{
		id: 'tech',
		name: '维修技师',
		collar: 'specialist-blue',
		floor: 3,
		department: '产品与技术',
		kind: 'repair',
		look: { body: 0x14b8a6, accent: 0xeab308, hat: true, tie: false },
		blurb: '看症状、检查，再换对的零件。',
		selectable: true
	},
	{
		id: 'engineer',
		name: '产品工程师',
		collar: 'specialist-white',
		floor: 3,
		department: '产品与技术',
		kind: 'ship',
		look: { body: 0xdbeafe, accent: 0x1d4ed8, hat: false, tie: false },
		blurb: '写测试、直接上线或重写，看严重度和故障类型。',
		selectable: true
	},
	{
		id: 'finance',
		name: '财务专员',
		collar: 'white',
		floor: 4,
		department: '人事与财务',
		kind: 'audit',
		look: { body: 0xf8fafc, accent: 0x60a5fa, hat: false, tie: true },
		blurb: '对照餐补、加班和票据规则，通过或驳回。',
		selectable: true
	},
	{
		id: 'manager',
		name: '运营经理',
		collar: 'manager',
		floor: 5,
		department: '经营管理',
		kind: 'allocate',
		look: { body: 0x1e3a8a, accent: 0xeab308, hat: false, tie: true },
		blurb: '把编制或预算从一楼调到另一楼，立刻看见负荷。',
		selectable: true
	},
	{
		id: 'ceo',
		name: '总经理',
		collar: 'ceo',
		floor: 5,
		department: '经营管理',
		kind: 'decide',
		look: { body: 0x0f172a, accent: 0xf97316, hat: false, tie: true },
		blurb: '拍公司决定：现金、士气、口碑和负荷会一起动。',
		selectable: true
	}
];

export function roleById(id: string): RoleDef | undefined {
	return ROLES.find((role) => role.id === id);
}

export function rolesByFloor(floor: FloorId): RoleDef[] {
	return ROLES.filter((role) => role.floor === floor);
}

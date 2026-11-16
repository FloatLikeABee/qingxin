import { roleById, type FloorId, type RoleId, type TaskKind } from './roles';

export const AUDIT_RULES = {
	mealMax: 80,
	overtimeNeedsFlag: true,
	requireReceipt: true
} as const;

export const PARTS = ['电源', '排线', '散热', '主板'] as const;
export type PartId = (typeof PARTS)[number];
export type BayId = 'A' | 'B' | 'C';
export type PriceBand = 'high' | 'fair' | 'low';
export type ShipAction = 'test' | 'ship' | 'rewrite';
export type ClaimCategory = '餐补' | '加班' | '交通';
export type ResourceKind = 'staff' | 'budget';
export type TaskStatus =
	'offered' | 'active' | 'done' | 'failed' | 'declined' | 'expired' | 'cancelled';

export interface SortBox {
	id: string;
	dest: BayId;
	x: number;
	z: number;
	held: boolean;
}

export interface AuditClaim {
	amount: number;
	category: ClaimCategory;
	hasReceipt: boolean;
	flagged: boolean;
}

export interface DecisionOption {
	id: string;
	label: string;
	detail: string;
	effects: {
		cash?: number;
		morale?: number;
		reputation?: number;
		workload?: { floor: FloorId; delta: number };
	};
}

export type TaskPayload =
	| { kind: 'sort'; boxes: SortBox[]; placed: number; needed: number }
	| {
			kind: 'negotiate';
			product: string;
			hiddenMax: number;
			patience: number;
			lastOffer?: PriceBand;
	  }
	| {
			kind: 'repair';
			device: string;
			symptoms: string[];
			clue?: string;
			correctPart: PartId;
			options: PartId[];
	  }
	| { kind: 'ship'; ticket: string; severity: 'low' | 'high'; fault: 'bug' | 'design' }
	| (AuditClaim & { kind: 'audit' })
	| { kind: 'allocate' }
	| { kind: 'decide'; topic: string; options: DecisionOption[] };

export interface Task {
	id: number;
	roleId: RoleId;
	kind: TaskKind;
	status: TaskStatus;
	title: string;
	detail: string;
	offeredAt: number;
	deadline: number;
	payload: TaskPayload;
	resultNote?: string;
}

export interface Dept {
	workload: number;
	staff: number;
	budget: number;
}

export interface WorkState {
	tick: number;
	notice: string;
	player: {
		roleId: RoleId;
		floor: FloorId;
		pay: number;
		reputation: number;
		carrying: string | null;
	};
	company: {
		cash: number;
		reputation: number;
		morale: number;
		departments: Record<FloorId, Dept>;
	};
	tasks: Task[];
	packages: SortBox[];
	nextId: number;
	rng: () => number;
}

const PRODUCTS = ['年度服务', '试用席位', '培训包'];
const DEVICES = ['前台电脑', '门禁闸机', '投影机'];
const TICKETS = ['登录超时', '导出乱码', '看板空白'];

function pick<T>(rng: () => number, list: readonly T[]): T {
	return list[Math.min(list.length - 1, Math.floor(rng() * list.length))] as T;
}

function activeTask(state: WorkState): Task | undefined {
	return state.tasks.find(
		(task) => task.status === 'active' && task.roleId === state.player.roleId
	);
}

function clamp(n: number, min: number, max: number) {
	return Math.min(max, Math.max(min, n));
}

function reward(
	state: WorkState,
	task: Task,
	ok: boolean,
	pay: number,
	rep: number,
	floor: FloorId,
	workload: number,
	note: string,
	extra?: { cash?: number; morale?: number; reputation?: number }
) {
	task.status = ok ? 'done' : 'failed';
	task.resultNote = note;
	if (ok) {
		state.player.pay += pay;
		state.player.reputation = clamp(state.player.reputation + rep, 0, 100);
		state.company.departments[floor].workload = clamp(
			state.company.departments[floor].workload + workload,
			0,
			100
		);
	} else {
		state.player.reputation = clamp(state.player.reputation + Math.min(0, rep), 0, 100);
		state.company.departments[floor].workload = clamp(
			state.company.departments[floor].workload + Math.max(0, workload),
			0,
			100
		);
	}
	if (extra?.cash) state.company.cash = clamp(state.company.cash + extra.cash, 0, 9999);
	if (extra?.morale) state.company.morale = clamp(state.company.morale + extra.morale, 0, 100);
	if (extra?.reputation)
		state.company.reputation = clamp(state.company.reputation + extra.reputation, 0, 100);
	state.notice = note;
}

export function shouldApproveClaim(claim: AuditClaim): boolean {
	if (AUDIT_RULES.requireReceipt && !claim.hasReceipt) return false;
	if (claim.category === '餐补' && claim.amount > AUDIT_RULES.mealMax) return false;
	if (claim.category === '加班' && AUDIT_RULES.overtimeNeedsFlag && !claim.flagged) return false;
	return true;
}

export function generateTask(roleId: RoleId, rng: () => number, tick: number, id: number): Task {
	const role = roleById(roleId);
	if (!role) throw new Error('unknown role');
	const deadline = tick + 180;
	const kind = role.kind;
	if (kind === 'sort') {
		const dest = pick(rng, ['A', 'B', 'C'] as const);
		const boxes: SortBox[] = [{ id: `pkg-${id}`, dest, x: 3, z: 2, held: false }];
		return {
			id,
			roleId,
			kind,
			status: 'offered',
			title: `分拣 ${boxes.length} 件到${dest}口`,
			detail: '到货口提起，放到字母相同的口。',
			offeredAt: tick,
			deadline,
			payload: { kind: 'sort', boxes, placed: 0, needed: boxes.length }
		};
	}
	if (kind === 'negotiate') {
		const product = pick(rng, PRODUCTS);
		const hiddenMax = 80 + Math.floor(rng() * 50);
		return {
			id,
			roleId,
			kind,
			status: 'offered',
			title: `谈 ${product}`,
			detail: '对方有隐藏上限。耐心条见底就会走。',
			offeredAt: tick,
			deadline,
			payload: { kind: 'negotiate', product, hiddenMax, patience: 3 }
		};
	}
	if (kind === 'repair') {
		const correctPart = pick(rng, PARTS);
		const device = pick(rng, DEVICES);
		const clues: Record<PartId, { symptoms: string[]; clue: string }> = {
			电源: { symptoms: ['灯不亮', '风扇不转'], clue: '插座没电，先换电源。' },
			排线: { symptoms: ['花屏', '接口松'], clue: '排线接触不良。' },
			散热: { symptoms: ['发烫', '过一会就关机'], clue: '风道堵了。' },
			主板: { symptoms: ['反复重启', '滴滴响'], clue: '主板自检失败。' }
		};
		return {
			id,
			roleId,
			kind,
			status: 'offered',
			title: `修 ${device}`,
			detail: clues[correctPart].symptoms.join('，'),
			offeredAt: tick,
			deadline,
			payload: {
				kind: 'repair',
				device,
				symptoms: clues[correctPart].symptoms,
				correctPart,
				options: [...PARTS]
			}
		};
	}
	if (kind === 'ship') {
		const ticket = pick(rng, TICKETS);
		const severity = rng() > 0.55 ? 'high' : 'low';
		const fault = rng() > 0.5 ? 'design' : 'bug';
		return {
			id,
			roleId,
			kind,
			status: 'offered',
			title: `工单 ${ticket}`,
			detail: `${severity === 'high' ? '高' : '低'}严重度 · ${fault === 'design' ? '设计问题' : '程序缺陷'}`,
			offeredAt: tick,
			deadline,
			payload: { kind: 'ship', ticket, severity, fault }
		};
	}
	if (kind === 'audit') {
		const category = pick(rng, ['餐补', '加班', '交通'] as const);
		const hasReceipt = rng() > 0.25;
		const flagged = rng() > 0.6;
		const amount = category === '餐补' ? 40 + Math.floor(rng() * 80) : 60 + Math.floor(rng() * 120);
		return {
			id,
			roleId,
			kind,
			status: 'offered',
			title: `核 ${category} ¥${amount}`,
			detail: `规则：餐补≤¥${AUDIT_RULES.mealMax}，加班要审批旗，无票据必驳。`,
			offeredAt: tick,
			deadline,
			payload: { kind: 'audit', amount, category, hasReceipt, flagged }
		};
	}
	if (kind === 'allocate') {
		return {
			id,
			roleId,
			kind,
			status: 'offered',
			title: '调编制或预算',
			detail: '从负荷高的楼抽 1 人/1 预算到负荷高的需求楼。编制不能抽空。',
			offeredAt: tick,
			deadline,
			payload: { kind: 'allocate' }
		};
	}
	const options: DecisionOption[] = [
		{
			id: 'overtime',
			label: '批加班预算',
			detail: '花钱换进度',
			effects: { cash: -20, morale: 8, workload: { floor: 3, delta: -12 } }
		},
		{
			id: 'freeze',
			label: '冻结招聘',
			detail: '省钱但伤士气',
			effects: { cash: 18, morale: -12, reputation: -4 }
		},
		{
			id: 'apology',
			label: '公开致歉客户',
			detail: '花钱修口碑',
			effects: { cash: -12, reputation: 12, workload: { floor: 2, delta: -10 } }
		}
	];
	return {
		id,
		roleId,
		kind,
		status: 'offered',
		title: '经营决定',
		detail: '每个选项会改两项以上数字。',
		offeredAt: tick,
		deadline,
		payload: { kind: 'decide', topic: '本周经营', options }
	};
}

export function acceptTask(state: WorkState, taskId: number): boolean {
	const task = state.tasks.find((item) => item.id === taskId);
	if (!task || task.status !== 'offered') return false;
	if (task.roleId !== state.player.roleId) {
		state.notice = '这不是你现在的岗位。';
		return false;
	}
	if (state.tasks.some((item) => item.status === 'active')) {
		state.notice = '先把手头的活做完或放下。';
		return false;
	}
	task.status = 'active';
	if (task.payload.kind === 'sort') {
		state.packages = task.payload.boxes.map((box) => ({ ...box, held: false }));
	}
	state.notice = `接了：${task.title}`;
	return true;
}

export function declineTask(state: WorkState, taskId: number): boolean {
	const task = state.tasks.find((item) => item.id === taskId);
	if (!task || task.status !== 'offered') return false;
	task.status = 'declined';
	state.notice = '推掉了这单。';
	return true;
}

export function retryTask(state: WorkState, taskId: number): boolean {
	const task = state.tasks.find((item) => item.id === taskId);
	if (!task || task.status !== 'failed') return false;
	const fresh = generateTask(task.roleId, state.rng, state.tick, task.id);
	task.status = 'offered';
	task.title = fresh.title;
	task.detail = fresh.detail;
	task.payload = fresh.payload;
	task.offeredAt = state.tick;
	task.deadline = state.tick + 180;
	task.resultNote = undefined;
	state.player.carrying = null;
	state.notice = '同一类活再来一单。';
	return true;
}

export function pickPackage(state: WorkState, packageId: string): boolean {
	const task = activeTask(state);
	if (!task || task.payload.kind !== 'sort') return false;
	if (state.player.carrying) {
		state.notice = '手里已经有一件。';
		return false;
	}
	const box = state.packages.find((item) => item.id === packageId);
	if (!box || box.held) return false;
	box.held = true;
	state.player.carrying = box.id;
	state.notice = `提起去${box.dest}口的包裹。`;
	return true;
}

export function placePackage(state: WorkState, bay: BayId): boolean {
	const task = activeTask(state);
	if (!task || task.payload.kind !== 'sort') return false;
	const id = state.player.carrying;
	if (!id) {
		state.notice = '先去到货口提包裹。';
		return false;
	}
	const box = state.packages.find((item) => item.id === id);
	if (!box) return false;
	state.player.carrying = null;
	state.packages = state.packages.filter((item) => item.id !== id);
	if (box.dest !== bay) {
		reward(state, task, false, 0, -2, 1, 8, `放到${bay}口了，签的是${box.dest}口。`);
		return false;
	}
	task.payload.placed += 1;
	if (task.payload.placed >= task.payload.needed) {
		reward(state, task, true, 12, 3, 1, -10, `分拣完成，${box.dest}口清了一件。`);
		return true;
	}
	state.notice = `入${bay}口。还差 ${task.payload.needed - task.payload.placed} 件。`;
	return true;
}

export function offerPrice(state: WorkState, band: PriceBand): boolean {
	const task = activeTask(state);
	if (!task || task.payload.kind !== 'negotiate') return false;
	const price = band === 'high' ? 120 : band === 'fair' ? 100 : 80;
	task.payload.lastOffer = band;
	if (price <= task.payload.hiddenMax) {
		reward(
			state,
			task,
			true,
			Math.round(price / 8),
			band === 'low' ? 1 : 4,
			2,
			-9,
			`${task.payload.product}成交 ¥${price}。`
		);
		state.company.cash = clamp(state.company.cash + price, 0, 9999);
		return true;
	}
	task.payload.patience -= 1;
	if (task.payload.patience <= 0) {
		reward(state, task, false, 0, -3, 2, 10, '对方不耐烦，走了。');
		return false;
	}
	state.notice = '摇头。再报一次，耐心还在。';
	return false;
}

export function inspectFault(state: WorkState): boolean {
	const task = activeTask(state);
	if (!task || task.payload.kind !== 'repair') return false;
	const clues: Record<PartId, string> = {
		电源: '插座没电，先换电源。',
		排线: '排线接触不良。',
		散热: '风道堵了。',
		主板: '主板自检失败。'
	};
	task.payload.clue = clues[task.payload.correctPart];
	state.notice = task.payload.clue;
	return true;
}

export function choosePart(state: WorkState, part: string): boolean {
	const task = activeTask(state);
	if (!task || task.payload.kind !== 'repair') return false;
	if (part !== task.payload.correctPart) {
		reward(state, task, false, 0, -2, 3, 9, `${part}对不上，机器还是坏的。`);
		return false;
	}
	reward(state, task, true, 14, 3, 3, -11, `换上${part}，故障清了。`);
	return true;
}

export function chooseShip(state: WorkState, action: ShipAction): boolean {
	const task = activeTask(state);
	if (!task || task.payload.kind !== 'ship') return false;
	if (action === 'test') {
		reward(state, task, true, 10, 2, 3, -5, '测试覆盖住了，发得慢但稳。');
		return true;
	}
	if (action === 'ship') {
		if (task.payload.severity === 'low') {
			reward(state, task, true, 18, 1, 3, -10, '低风险，直接上了。');
			return true;
		}
		reward(state, task, false, 0, -4, 3, 12, '高严重度直接上线，回滚了。');
		return false;
	}
	if (task.payload.fault === 'design') {
		reward(state, task, true, 16, 3, 3, -8, '设计问题，重写才对。');
		return true;
	}
	reward(state, task, false, 0, -2, 3, 7, '这是缺陷，不该整段重写。');
	return false;
}

export function judgeClaim(state: WorkState, decision: 'approve' | 'reject'): boolean {
	const task = activeTask(state);
	if (!task || task.payload.kind !== 'audit') return false;
	const claim = task.payload;
	const should = shouldApproveClaim(claim);
	const approved = decision === 'approve';
	if (approved === should) {
		reward(state, task, true, 15, 3, 4, -8, approved ? '这笔对得上规则。' : '按规则驳回了。');
		return true;
	}
	if (approved) {
		reward(state, task, false, 0, -4, 4, 6, '不该过的单过了。', { cash: -claim.amount });
	} else {
		reward(state, task, false, 0, -5, 4, 4, '把合规单驳了，同事不服。', { morale: -6 });
	}
	return false;
}

export function moveResource(
	state: WorkState,
	from: FloorId,
	to: FloorId,
	resource: ResourceKind
): boolean {
	const task = activeTask(state);
	if (!task || task.payload.kind !== 'allocate') return false;
	if (from === to) {
		state.notice = '同一层不用调。';
		return false;
	}
	const source = state.company.departments[from];
	const dest = state.company.departments[to];
	if (resource === 'staff') {
		if (source.staff <= 1) {
			source.workload = clamp(source.workload + 8, 0, 100);
			state.notice = `${from}楼编制不能再抽。`;
			reward(state, task, false, 0, -2, from, 0, state.notice);
			return false;
		}
		source.staff -= 1;
		dest.staff += 1;
		source.workload = clamp(source.workload + 6, 0, 100);
		dest.workload = clamp(dest.workload - 10, 0, 100);
		reward(state, task, true, 11, 2, to, 0, `把${from}楼 1 人调到${to}楼。`);
		return true;
	}
	if (source.budget <= 5) {
		state.notice = `${from}楼预算见底。`;
		reward(state, task, false, 0, -1, from, 4, state.notice);
		return false;
	}
	source.budget -= 5;
	dest.budget += 5;
	source.workload = clamp(source.workload + 4, 0, 100);
	dest.workload = clamp(dest.workload - 7, 0, 100);
	reward(state, task, true, 9, 2, to, 0, `把${from}楼 5 预算拨到${to}楼。`);
	return true;
}

export function chooseDecision(state: WorkState, optionId: string): boolean {
	const task = activeTask(state);
	if (!task || task.payload.kind !== 'decide') return false;
	const option = task.payload.options.find((item) => item.id === optionId);
	if (!option) return false;
	const extra = {
		cash: option.effects.cash,
		morale: option.effects.morale,
		reputation: option.effects.reputation
	};
	if (option.effects.workload) {
		const { floor, delta } = option.effects.workload;
		state.company.departments[floor].workload = clamp(
			state.company.departments[floor].workload + delta,
			0,
			100
		);
	}
	reward(state, task, true, 20, 4, 5, -4, option.label, extra);
	return true;
}

export function liveQueue(state: WorkState): Task[] {
	return state.tasks.filter(
		(task) =>
			(task.status === 'offered' || task.status === 'active') && task.roleId === state.player.roleId
	);
}

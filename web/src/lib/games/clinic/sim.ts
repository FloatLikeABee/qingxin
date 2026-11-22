export const SLIP_MAX = 80;
export const JAR_MIN = 2;
export const JAR_MAX = 5;
export const PACK_MIN = 1;
export const PACK_MAX = 3;
export const SEEN_CAP = 24;

export const STORY_TAGS = [
	'怕风',
	'夜咳',
	'口干',
	'腹鸣',
	'舌彩',
	'困午',
	'身沉',
	'怕湿',
	'眠浅',
	'气短',
	'喉甜'
] as const;
export type StoryTag = (typeof STORY_TAGS)[number];

export const HERB_IDS = [
	'danggui',
	'huangqi',
	'gouqi',
	'juhua',
	'gancao',
	'fuling',
	'chenpi',
	'shengjiang',
	'hongzao',
	'bohe',
	'guizhi',
	'baizhu'
] as const;
export type HerbId = (typeof HERB_IDS)[number];

export const CASE_IDS = ['fox-draft', 'clerk-tea', 'turtle-well', 'kite-cloud'] as const;
export type CaseId = (typeof CASE_IDS)[number];

export type ClinicPhase =
	'disclaimer' | 'hall' | 'talk' | 'examine' | 'write' | 'dispense' | 'recovery';
export type ExamineKind = 'look' | 'listen' | 'pulse';
export type ClinicOutcome = 'warm' | 'partial' | 'mismatch';

export type PickedJar = { id: HerbId; packs: number };

export type Herb = {
	id: HerbId;
	name: string;
	tags: StoryTag[];
};

export type ClinicCase = {
	id: CaseId;
	name: string;
	seat: string;
	lines: string[];
	tags: [StoryTag, StoryTag, StoryTag];
	examines: Record<ExamineKind, { tag: StoryTag; flavor: string }>;
};

export type ClinicWorld = {
	phase: ClinicPhase;
	disclaimerAck: boolean;
	caseId: CaseId;
	talkIndex: number;
	revealedTags: StoryTag[];
	examined: ExamineKind[];
	examineNote: string;
	slip: string;
	jars: PickedJar[];
	notice: string;
	recovery: string;
	covered: StoryTag[];
	seenCaseIds: CaseId[];
	lastSlip: { text: string; herbs: PickedJar[] } | null;
	lowDetail: boolean;
	audioWanted: boolean;
	dockCollapsed: boolean;
	paused: boolean;
	recovered: boolean;
	dispenseT: number;
	narrow: boolean;
};

export const HUD_DISCLAIMER = '虚构娱乐，不是诊疗，没有真实剂量，不能当医嘱。';

export const DISCLAIMER_COPY =
	'本馆病例都是编的。药名只是气味标签，数量是游戏里的药包，不是克、钱或医嘱。点「我明白，开始虚构接诊」进候诊厅。';

export const ACK_LABEL = '我明白，开始虚构接诊';

export const FORBIDDEN_COPY = /疗效|主治|治愈|mg|适应症/;

export const EXAMINE_LABEL: Record<ExamineKind, string> = {
	look: '望',
	listen: '闻',
	pulse: '把脉'
};

export const HERBS: Herb[] = [
	{ id: 'danggui', name: '当归', tags: ['怕风', '身沉'] },
	{ id: 'huangqi', name: '黄芪', tags: ['气短', '困午'] },
	{ id: 'gouqi', name: '枸杞', tags: ['口干', '眠浅'] },
	{ id: 'juhua', name: '菊花', tags: ['夜咳', '喉甜'] },
	{ id: 'gancao', name: '甘草', tags: ['腹鸣', '喉甜'] },
	{ id: 'fuling', name: '茯苓', tags: ['怕湿', '腹鸣'] },
	{ id: 'chenpi', name: '陈皮', tags: ['腹鸣', '困午'] },
	{ id: 'shengjiang', name: '生姜', tags: ['怕风', '夜咳'] },
	{ id: 'hongzao', name: '红枣', tags: ['口干', '身沉'] },
	{ id: 'bohe', name: '薄荷', tags: ['舌彩', '喉甜'] },
	{ id: 'guizhi', name: '桂枝', tags: ['怕风', '眠浅'] },
	{ id: 'baizhu', name: '白术', tags: ['怕湿', '困午'] }
];

const HERB_MAP = new Map(HERBS.map((herb) => [herb.id, herb]));

export function herbById(id: string): Herb | undefined {
	return HERB_MAP.get(id as HerbId);
}

export function isHerbId(value: string): value is HerbId {
	return HERB_MAP.has(value as HerbId);
}

export const CASES: ClinicCase[] = [
	{
		id: 'fox-draft',
		name: '梦里受风的狐狸',
		seat: '靠窗长凳',
		lines: [
			'「我是一只会说人话的狐狸，昨晚在别人的梦里站岗。」',
			'「梦门口灌进来一股穿堂风，我的尾巴尖到现在还凉。」',
			'「夜里会干咳两声，像有人在远处折纸。」',
			'「嘴里也发干，想喝一口并不存在的井水。」'
		],
		tags: ['怕风', '夜咳', '口干'],
		examines: {
			look: { tag: '怕风', flavor: '耳尖的毛被风吹向同一侧。这是故事标签「怕风」，不是证型。' },
			listen: { tag: '夜咳', flavor: '干咳轻轻的，像折纸。故事标签「夜咳」。' },
			pulse: { tag: '口干', flavor: '腕上的节拍干而浅。故事标签「口干」。把脉只是游戏手势。' }
		}
	},
	{
		id: 'clerk-tea',
		name: '喝了彩虹茶的书记员',
		seat: '账桌旁',
		lines: [
			'「我在彩虹茶铺记账，昨天把账本泡进杯子里了。」',
			'「肚子里像有一小队鼓在走，咕噜咕噜。」',
			'「舌头上好像还留着一层粉色的糖纸。」',
			'「一到午后眼皮就往下掉，笔会自己画画。」'
		],
		tags: ['腹鸣', '舌彩', '困午'],
		examines: {
			look: { tag: '舌彩', flavor: '舌面像一层糖纸反光。故事标签「舌彩」。' },
			listen: { tag: '腹鸣', flavor: '腹中小鼓还在走。故事标签「腹鸣」。' },
			pulse: { tag: '困午', flavor: '午后的拍子发软。故事标签「困午」。' }
		}
	},
	{
		id: 'turtle-well',
		name: '在月井打盹的石龟',
		seat: '门槛青石',
		lines: [
			'「我是井边的石龟，不是来挂号的人。」',
			'「在月亮井沿打了个盹，醒来壳比石头还沉。」',
			'「潮气贴在甲缝里，像穿了一件湿外套。」',
			'「浅眠时能听见井底有人数星星。」'
		],
		tags: ['身沉', '怕湿', '眠浅'],
		examines: {
			look: { tag: '身沉', flavor: '壳沿还沾着井苔。故事标签「身沉」。' },
			listen: { tag: '怕湿', flavor: '甲缝里有细细的潮声。故事标签「怕湿」。' },
			pulse: { tag: '眠浅', flavor: '拍子像浅眠里数星星。故事标签「眠浅」。' }
		}
	},
	{
		id: 'kite-cloud',
		name: '卡在饺子云里的风筝',
		seat: '梁上挂钩',
		lines: [
			'「我是一只卡在饺子云里的风筝，线还在。」',
			'「云馅太软，我提不上气。」',
			'「线头甜得像谁洒了糖霜。」',
			'「云缝里那阵风还是往领口里钻。」'
		],
		tags: ['气短', '喉甜', '怕风'],
		examines: {
			look: { tag: '怕风', flavor: '纸边还朝一个方向翻。故事标签「怕风」。' },
			listen: { tag: '气短', flavor: '骨架轻轻哼，提气提不全。故事标签「气短」。' },
			pulse: { tag: '喉甜', flavor: '线头沾着糖霜。故事标签「喉甜」。' }
		}
	}
];

const CASE_MAP = new Map(CASES.map((item) => [item.id, item]));

export function caseById(id: string): ClinicCase | undefined {
	return CASE_MAP.get(id as CaseId);
}

export function isCaseId(value: string): value is CaseId {
	return CASE_MAP.has(value as CaseId);
}

export function isCompactClinic(width: number) {
	return width > 0 && width < 500;
}

export function allClinicCopy(): string[] {
	const blobs: string[] = [
		HUD_DISCLAIMER,
		DISCLAIMER_COPY,
		ACK_LABEL,
		'还没选药',
		'一次最多五味',
		'药包够了',
		'厅里重新收拾好了。'
	];
	for (const herb of HERBS) blobs.push(herb.name, ...herb.tags);
	for (const item of CASES) {
		blobs.push(item.name, item.seat, ...item.lines, ...item.tags);
		blobs.push(item.examines.look.flavor, item.examines.listen.flavor, item.examines.pulse.flavor);
		blobs.push(
			recoveryCopy(item, 'warm', item.tags.slice(0, 2) as StoryTag[], []),
			recoveryCopy(item, 'partial', [item.tags[0]], [item.tags[1], item.tags[2]]),
			recoveryCopy(item, 'mismatch', [], [...item.tags])
		);
	}
	return blobs;
}

export function clinicCopyForbidden() {
	return allClinicCopy().some((text) => FORBIDDEN_COPY.test(text));
}

function clamp(n: number, min: number, max: number) {
	return Math.min(max, Math.max(min, n));
}

export function coverTags(caseTags: StoryTag[], jars: PickedJar[]): StoryTag[] {
	const covered: StoryTag[] = [];
	for (const jar of jars) {
		const herb = herbById(jar.id);
		if (!herb) continue;
		for (const tag of herb.tags) {
			if (caseTags.includes(tag) && !covered.includes(tag)) covered.push(tag);
		}
	}
	return covered;
}

export function outcomeFor(covered: StoryTag[]): ClinicOutcome {
	if (covered.length >= 2) return 'warm';
	if (covered.length === 1) return 'partial';
	return 'mismatch';
}

export function recoveryCopy(
	item: ClinicCase,
	outcome: ClinicOutcome,
	matched: StoryTag[],
	missing: StoryTag[]
) {
	if (outcome === 'warm') {
		return `${item.name}回来晃了晃，把「${matched.join('、')}」写进今天的笑话里。它说自己本来就好好地在故事里走。这是回访，不是把谁医好了。`;
	}
	if (outcome === 'partial') {
		const gap = missing[0] ?? item.tags[0];
		return `${item.name}回来问：「${gap}那一层后来怎样？」语气仍旧客气。故事还在写，没有对错分。`;
	}
	return `${item.name}笑了笑，说这包气味很热闹，它自己本来就好好地晒月亮。错配也只是笑料，它没事。`;
}

export function currentCase(world: ClinicWorld) {
	return caseById(world.caseId) ?? CASES[0]!;
}

function pickNextCase(seen: CaseId[]): CaseId {
	const unused = CASE_IDS.filter((id) => !seen.includes(id));
	const pool = unused.length > 0 ? unused : [...CASE_IDS];
	return pool[seen.length % pool.length]!;
}

function resetVisit(world: ClinicWorld, caseId: CaseId) {
	world.caseId = caseId;
	world.talkIndex = 0;
	world.revealedTags = [];
	world.examined = [];
	world.examineNote = '';
	world.slip = '';
	world.jars = [];
	world.recovery = '';
	world.covered = [];
	world.dispenseT = 0;
	world.notice = `${caseById(caseId)?.name ?? '客人'}坐在候诊厅。先听它把故事说完。`;
}

export function createClinic(): ClinicWorld {
	return {
		phase: 'disclaimer',
		disclaimerAck: false,
		caseId: 'fox-draft',
		talkIndex: 0,
		revealedTags: [],
		examined: [],
		examineNote: '',
		slip: '',
		jars: [],
		notice: DISCLAIMER_COPY,
		recovery: '',
		covered: [],
		seenCaseIds: [],
		lastSlip: null,
		lowDetail: false,
		audioWanted: false,
		dockCollapsed: false,
		paused: false,
		recovered: false,
		dispenseT: 0,
		narrow: false
	};
}

export function ackDisclaimer(world: ClinicWorld) {
	world.disclaimerAck = true;
	world.phase = 'hall';
	resetVisit(world, world.caseId);
	world.notice = `虚构娱乐。${currentCase(world).name}坐在${currentCase(world).seat}。`;
}

export function startTalk(world: ClinicWorld) {
	if (!world.disclaimerAck || world.paused) return;
	if (world.phase !== 'hall' && world.phase !== 'talk') return;
	world.phase = 'talk';
	if (world.talkIndex === 0) world.talkIndex = 1;
	world.notice = currentCase(world).lines[0] ?? '';
}

export function advanceTalk(world: ClinicWorld) {
	if (!world.disclaimerAck || world.paused) return;
	if (world.phase !== 'talk' && world.phase !== 'hall') startTalk(world);
	const item = currentCase(world);
	if (world.talkIndex < item.lines.length) {
		world.talkIndex += 1;
		world.notice = item.lines[world.talkIndex - 1] ?? '';
	}
	if (world.talkIndex >= item.lines.length) {
		world.revealedTags = [...item.tags];
		world.phase = 'examine';
		world.notice = `故事标签：${item.tags.join('、')}。可以望、闻、把脉，或去写纸条。`;
	}
}

export function examine(world: ClinicWorld, kind: ExamineKind) {
	if (!world.disclaimerAck || world.paused) return;
	if (world.phase === 'hall') startTalk(world);
	if (world.talkIndex < currentCase(world).lines.length) {
		world.notice = '先把故事听完。';
		return;
	}
	world.phase = 'examine';
	const item = currentCase(world);
	const found = item.examines[kind];
	if (world.examined.includes(kind)) {
		world.notice = `已经${EXAMINE_LABEL[kind]}过了。`;
		return;
	}
	world.examined = [...world.examined, kind];
	if (!world.revealedTags.includes(found.tag))
		world.revealedTags = [...world.revealedTags, found.tag];
	world.examineNote = found.flavor;
	world.notice = found.flavor;
}

export function beginWrite(world: ClinicWorld) {
	if (!world.disclaimerAck || world.paused) return;
	if (world.talkIndex < currentCase(world).lines.length) {
		world.notice = '先把故事听完。';
		return;
	}
	world.phase = 'write';
	world.notice = '写一张不超过八十个字的纸条，再选二到五只罐子。数量是药包。';
}

export function setSlip(world: ClinicWorld, text: string) {
	world.slip = Array.from(text).slice(0, SLIP_MAX).join('');
}

export function toggleJar(world: ClinicWorld, id: HerbId): boolean {
	if (!world.disclaimerAck || world.paused) return false;
	if (world.phase !== 'write' && world.phase !== 'examine') beginWrite(world);
	const at = world.jars.findIndex((jar) => jar.id === id);
	if (at >= 0) {
		world.jars = world.jars.filter((jar) => jar.id !== id);
		world.notice = `放下了${herbById(id)?.name ?? id}。`;
		return true;
	}
	if (world.jars.length >= JAR_MAX) {
		world.notice = '一次最多五味';
		return false;
	}
	world.jars = [...world.jars, { id, packs: 1 }];
	world.notice = `拿起${herbById(id)?.name ?? id}，一药包。`;
	return true;
}

export function setPacks(world: ClinicWorld, id: HerbId, packs: number): boolean {
	const jar = world.jars.find((item) => item.id === id);
	if (!jar) return false;
	const next = Math.round(clamp(packs, PACK_MIN, PACK_MAX));
	if (!Number.isFinite(packs) || packs < PACK_MIN || packs > PACK_MAX) {
		world.notice = '药包只能是一到三。';
	}
	jar.packs = next;
	return true;
}

export function dispense(world: ClinicWorld): boolean {
	if (!world.disclaimerAck || world.paused) return false;
	if (world.jars.length < JAR_MIN) {
		world.notice = '还没选药';
		return false;
	}
	if (world.jars.length > JAR_MAX) {
		world.notice = '一次最多五味';
		return false;
	}
	const item = currentCase(world);
	const covered = coverTags(item.tags, world.jars);
	const missing = item.tags.filter((tag) => !covered.includes(tag));
	const outcome = outcomeFor(covered);
	world.covered = covered;
	world.recovery = recoveryCopy(item, outcome, covered, missing);
	world.lastSlip = {
		text: world.slip,
		herbs: world.jars.map((jar) => ({ id: jar.id, packs: jar.packs }))
	};
	world.dispenseT = 0;
	world.phase = 'dispense';
	world.notice = '柜子里的罐子轻轻跳进布包。抓药开始了。';
	return true;
}

export function stepClinic(world: ClinicWorld, dt: number) {
	if (world.paused || dt <= 0) return;
	if (world.phase !== 'dispense') return;
	world.dispenseT = Math.min(1, world.dispenseT + dt / 900);
	if (world.dispenseT >= 1) {
		world.phase = 'recovery';
		world.notice = world.recovery;
		if (!world.seenCaseIds.includes(world.caseId)) {
			world.seenCaseIds = [...world.seenCaseIds, world.caseId].slice(-SEEN_CAP);
		}
	}
}

export function nextPatient(world: ClinicWorld) {
	if (!world.disclaimerAck) return;
	const next = pickNextCase(world.seenCaseIds);
	world.phase = 'hall';
	resetVisit(world, next);
}

export function jarWorld(index: number, compact = false) {
	const col = index % 4;
	const row = Math.floor(index / 4);
	if (compact) {
		return { x: -1.02 + col * 0.68, y: 0.52, z: -0.2 - row * 0.54 };
	}
	return { x: 0.62 + col * 0.5, y: 1.55 - row * 0.58, z: -0.28 };
}

export function patientWorld(compact = false) {
	if (compact) return { x: 0, y: 0.42, z: 0.58 };
	return { x: -1.15, y: 0.48, z: 0.35 };
}

import { MEDICAL_DISCLAIMER, REMINDER_DISCLAIMER } from './schedule';

export interface ElderReminder {
	id: string;
	title: string;
	body: string;
	kind: 'medication' | 'general';
	time: string;
	daysOfWeek: number[];
	voiceText: string;
}

export interface ElderContact {
	id: string;
	name: string;
	relation: string;
	phone: string;
	isEmergency?: boolean;
}

export interface ElderTutorial {
	id: string;
	title: string;
	steps: { text: string }[];
}

export interface FraudScript {
	id: string;
	title: string;
	body: string;
	sourceName: string;
	sourceUrl: string;
}

export const EMERGENCY_CONTACTS: ElderContact[] = [
	{ id: 'emergency-120', name: '急救中心', relation: '紧急', phone: '120', isEmergency: true },
	{ id: 'emergency-110', name: '报警', relation: '紧急', phone: '110', isEmergency: true }
];

export const SYSTEM_TUTORIALS: ElderTutorial[] = [
	{
		id: 'hospital',
		title: '医院挂号',
		steps: [
			{ text: '打开医院公众号或国家医保服务平台' },
			{ text: '选择就诊医院与科室' },
			{ text: '确认就诊人并提交，记下预约时间' }
		]
	},
	{
		id: 'social',
		title: '社保认证',
		steps: [
			{ text: '打开电子社保卡或当地人社 App' },
			{ text: '进入待遇资格认证' },
			{ text: '按提示完成人脸识别，看到成功即可' }
		]
	},
	{
		id: 'health-code',
		title: '健康码/扫码',
		steps: [
			{ text: '打开微信或支付宝' },
			{ text: '点扫一扫，对准场所码' },
			{ text: '确认本人信息后给工作人员查看' }
		]
	}
];

export const FRAUD_SCRIPTS: FraudScript[] = [
	{
		id: 'police',
		title: '冒充公检法',
		body: '自称公安、检察院、法院，说你的卡涉案或要转到“安全账户”，都是诈骗。公检法不会电话办案。请挂断并拨打 110 或 96110。',
		sourceName: '国家反诈中心',
		sourceUrl: 'https://www.gjfzpt.cn/'
	},
	{
		id: 'errands',
		title: '刷单返利',
		body: '先小额返利再要求垫资、充值、做更多任务，随后失联，都是诈骗。刷单本身违法。',
		sourceName: '国家反诈中心（公安机关防诈关键词转载）',
		sourceUrl: 'http://legalinfo.moj.gov.cn/zhfxfzzx/fzzxyw/202506/t20250620_521303.html'
	},
	{
		id: 'invest',
		title: '虚假投资理财',
		body: '陌生群推荐“稳赚不赔、高额回报”，或要求下载不明投资 App 充值，都是诈骗。本应用不提供理财建议。',
		sourceName: '国家反诈中心',
		sourceUrl: 'https://www.gjfzpt.cn/'
	},
	{
		id: 'refund',
		title: '客服退款/快递理赔',
		body: '自称客服或快递要退款，让你点链接、下载远控软件或把钱转到“核对账户”，都是诈骗。请走官方 App。',
		sourceName: '国家反诈中心',
		sourceUrl: 'https://www.gjfzpt.cn/'
	}
];

const STORE_KEY = 'qingxin.elder.demo';

export interface ElderDemoState {
	reminders: ElderReminder[];
	contacts: ElderContact[];
	optInLog: boolean;
	acked: string[];
}

const seed: ElderDemoState = {
	reminders: [
		{
			id: 'med-1',
			title: '降压药',
			body: '早餐后一粒',
			kind: 'medication',
			time: '08:00',
			daysOfWeek: [1, 2, 3, 4, 5],
			voiceText: '该吃降压药了'
		}
	],
	contacts: [{ id: 'c-1', name: '女儿', relation: '子女', phone: '13800138000' }],
	optInLog: false,
	acked: []
};

export function loadDemo(): ElderDemoState {
	if (typeof localStorage === 'undefined') return structuredClone(seed);
	try {
		const raw = localStorage.getItem(STORE_KEY);
		if (!raw) return structuredClone(seed);
		return { ...structuredClone(seed), ...JSON.parse(raw) };
	} catch {
		return structuredClone(seed);
	}
}

export function saveDemo(state: ElderDemoState) {
	try {
		localStorage.setItem(STORE_KEY, JSON.stringify(state));
	} catch {
		// ignore
	}
}

export function allContacts(state: ElderDemoState): ElderContact[] {
	return [...EMERGENCY_CONTACTS, ...state.contacts];
}

export function todayCopy() {
	return { disclaimer: REMINDER_DISCLAIMER, medical: MEDICAL_DISCLAIMER };
}

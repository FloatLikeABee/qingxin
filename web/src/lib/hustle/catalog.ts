import type { Application } from './funnel';
import type { ResumeContent } from './resume';

export const HUSTLE_KINDS = ['线上', '线下', '技能型'] as const;
export type HustleKind = (typeof HUSTLE_KINDS)[number];

export const INTERVIEW_ROLES = ['前端', '后端', '产品', '运营'] as const;
export type InterviewRole = (typeof INTERVIEW_ROLES)[number];

export const INTERVIEW_DIFFICULTIES = ['基础', '进阶', '困难'] as const;
export type InterviewDifficulty = (typeof INTERVIEW_DIFFICULTIES)[number];

export interface InterviewQuestion {
	id: string;
	role: InterviewRole;
	difficulty: InterviewDifficulty;
	prompt: string;
}

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
	{
		id: 'fe-box',
		role: '前端',
		difficulty: '基础',
		prompt: '解释盒模型，以及 box-sizing 会怎样改变它。'
	},
	{
		id: 'fe-virtual',
		role: '前端',
		difficulty: '进阶',
		prompt: '虚拟列表要解决什么问题？你会怎么测量行高？'
	},
	{ id: 'fe-perf', role: '前端', difficulty: '困难', prompt: '一次卡顿排查：你会从哪些指标入手？' },
	{
		id: 'be-index',
		role: '后端',
		difficulty: '基础',
		prompt: '什么时候该给一列加索引？什么时候不该加？'
	},
	{ id: 'be-tx', role: '后端', difficulty: '进阶', prompt: '讲一次你处理过的事务隔离或锁等待。' },
	{
		id: 'be-scale',
		role: '后端',
		difficulty: '困难',
		prompt: '读多写少的接口，你会怎么做缓存与失效？'
	},
	{ id: 'pm-prio', role: '产品', difficulty: '基础', prompt: '需求很多时，你用什么原则排优先级？' },
	{
		id: 'pm-metric',
		role: '产品',
		difficulty: '进阶',
		prompt: '如何证明一个改动值得做？你看哪些指标？'
	},
	{
		id: 'ops-sop',
		role: '运营',
		difficulty: '基础',
		prompt: '你怎样写一份别人能接着做的活动 SOP？'
	},
	{
		id: 'ops-growth',
		role: '运营',
		difficulty: '进阶',
		prompt: '拉新遇到瓶颈时，你先验证哪三个假设？'
	}
];

export interface SideHustle {
	id: string;
	title: string;
	platform: string;
	estimatedIncome: number;
	skillsRequired: string[];
	kind: HustleKind;
	hoursPerWeek?: number | null;
	createdAt?: string;
}

export const SEED_SIDE_HUSTLES: SideHustle[] = [
	{
		id: 'seed-hustle-online',
		title: '技术文档翻译',
		platform: '线上接单',
		estimatedIncome: 2000,
		skillsRequired: ['英语', '写作'],
		kind: '线上'
	},
	{
		id: 'seed-hustle-offline',
		title: '周末摄影陪拍',
		platform: '本地',
		estimatedIncome: 800,
		skillsRequired: ['摄影'],
		kind: '线下'
	},
	{
		id: 'seed-hustle-skill',
		title: 'PPT 模板小店',
		platform: '技能型平台',
		estimatedIncome: 1500,
		skillsRequired: ['设计'],
		kind: '技能型'
	}
];

export const DEFAULT_RESUME: ResumeContent = {
	name: '林轻心',
	title: '前端工程师',
	email: 'lin@qingxin.app',
	phone: '',
	summary: '把复杂界面做成安静、可点、可离线的小工具。',
	education: [{ school: '轻心大学', degree: '计算机', years: '2018 – 2022' }],
	experience: [
		{
			company: '河岸工作室',
			role: '前端',
			years: '2023 – 今',
			bullets: '负责组件库与离线缓存，让页面在弱网下仍能读。'
		}
	],
	skills: ['TypeScript', 'Svelte', '无障碍']
};

export function seedApplications(now = new Date()): Application[] {
	const today = now.toISOString().slice(0, 10);
	return [
		{
			id: 'seed-app-interview',
			company: '轻心实验室',
			position: '前端工程师',
			status: '面试',
			interviewDate: today,
			notes: '问了盒模型，准备补一个列表虚拟化的例子。'
		},
		{
			id: 'seed-app-applied',
			company: '河岸工作室',
			position: '产品助理',
			status: '投递',
			notes: ''
		},
		{
			id: 'seed-app-offer',
			company: '云停科技',
			position: '运营',
			status: 'Offer',
			interviewDate: '2026-10-01',
			notes: '聊了活动 SOP。'
		}
	];
}

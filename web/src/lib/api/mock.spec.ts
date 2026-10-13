import { describe, expect, it } from 'vitest';
import { ApiError, MockQingxinApi } from './mock';
import { MODULES } from '../modules';

describe('MockQingxinApi', () => {
	it('rejects empty login credentials with a typed error', async () => {
		const api = new MockQingxinApi();
		await expect(api.login('', '')).rejects.toMatchObject({
			code: 'invalid_credentials'
		});
		await expect(api.login('', '')).rejects.toBeInstanceOf(ApiError);
	});

	it('returns a session for known-good credentials', async () => {
		const api = new MockQingxinApi();
		const session = await api.login('demo@qingxin.app', 'qingxin');
		expect(session.userId).toBeTruthy();
		expect(session.displayName).toBeTruthy();
		await expect(api.getSession()).resolves.toEqual(session);
	});

	it('restores a session from localStorage after a new client is created', async () => {
		const memory = new Map<string, string>();
		const fake = {
			getItem: (key: string) => memory.get(key) ?? null,
			setItem: (key: string, value: string) => {
				memory.set(key, value);
			},
			removeItem: (key: string) => {
				memory.delete(key);
			}
		};
		Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });
		const api = new MockQingxinApi();
		await api.login('demo@qingxin.app', 'qingxin');
		const restored = new MockQingxinApi();
		await expect(restored.getSession()).resolves.toMatchObject({ email: 'demo@qingxin.app' });
	});

	it('registers a user and stores the session', async () => {
		const api = new MockQingxinApi();
		const session = await api.register('林轻心', 'lin@qingxin.app', 'secret12');
		expect(session.displayName).toBe('林轻心');
		await expect(api.getSession()).resolves.toMatchObject({ userId: session.userId });
	});

	it('lists the ten product modules', async () => {
		const api = new MockQingxinApi();
		const modules = await api.listModules();
		expect(modules.map((item) => item.name)).toEqual(MODULES.map((item) => item.name));
		expect(modules).toHaveLength(10);
	});

	it('exports a JSON payload for the current session', async () => {
		const api = new MockQingxinApi();
		await api.login('demo@qingxin.app', 'qingxin');
		const exported = await api.exportUserData();
		expect(exported.exportedAt).toBeTruthy();
		expect(exported.data).toMatchObject({ email: 'demo@qingxin.app' });
		expect(exported.data.applications?.length).toBeGreaterThan(0);
		expect(exported.data.resumes?.length).toBeGreaterThan(0);
		expect(exported.data.sideHustles?.length).toBeGreaterThan(0);
	});

	it('clears the session after account deletion', async () => {
		const api = new MockQingxinApi();
		await api.login('demo@qingxin.app', 'qingxin');
		await api.deleteAccount();
		await expect(api.getSession()).resolves.toBeNull();
	});

	it('creates a mood log and rejects a 100-character note', async () => {
		const api = new MockQingxinApi();
		await api.login('demo@qingxin.app', 'qingxin');
		const log = await api.createMoodLog({ emoji: '😔', tags: ['睡眠'], note: '夜里醒了两次' });
		expect(log.score).toBe(2);
		expect(log.note).toBe('夜里醒了两次');
		await expect(
			api.createMoodLog({ emoji: '🙂', tags: [], note: '字'.repeat(100) })
		).rejects.toMatchObject({ code: 'invalid_request' });
		const listed = await api.listMoodLogs();
		expect(listed.some((item) => item.id === log.id)).toBe(true);
	});

	it('returns a mock insight with a non-medical disclaimer', async () => {
		const api = new MockQingxinApi();
		await api.login('demo@qingxin.app', 'qingxin');
		const insight = await api.createMoodInsight({ emoji: '😔', tags: ['睡眠'] });
		expect(insight.source).toBe('mock');
		expect(insight.disclaimer).toContain('不构成医疗建议');
		expect(insight.text.length).toBeGreaterThan(4);
	});

	it('lists the meditation catalog ids', async () => {
		const api = new MockQingxinApi();
		await api.login('demo@qingxin.app', 'qingxin');
		const catalog = await api.getMeditationCatalog();
		expect(catalog.sounds.map((item) => item.id)).toEqual([
			'rain',
			'waves',
			'fan',
			'fire',
			'white'
		]);
		expect(catalog.stories.length).toBeGreaterThanOrEqual(2);
		const session = await api.createMeditationSession({ kind: 'breathe', durationSec: 76 });
		expect(session.kind).toBe('breathe');
	});

	it('keeps a new check-in after a fresh client restores the session', async () => {
		const memory = new Map<string, string>();
		const fake = {
			getItem: (key: string) => memory.get(key) ?? null,
			setItem: (key: string, value: string) => {
				memory.set(key, value);
			},
			removeItem: (key: string) => {
				memory.delete(key);
			}
		};
		Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });
		const api = new MockQingxinApi();
		await api.login('demo@qingxin.app', 'qingxin');
		const saved = await api.createMoodLog({ emoji: '😔', tags: ['睡眠'], note: '刚写下的一笔' });
		const restored = new MockQingxinApi();
		await restored.getSession();
		const listed = await restored.listMoodLogs();
		expect(listed.some((item) => item.id === saved.id && item.note === '刚写下的一笔')).toBe(true);
	});

	it('returns the existing row when the same client id is posted twice', async () => {
		const api = new MockQingxinApi();
		await api.login('demo@qingxin.app', 'qingxin');
		const id = '11111111-1111-4111-8111-111111111111';
		const first = await api.createMoodLog({
			id,
			emoji: '😔',
			tags: ['睡眠'],
			note: '夜里醒了两次'
		});
		const second = await api.createMoodLog({
			id,
			emoji: '😔',
			tags: ['睡眠'],
			note: '夜里醒了两次'
		});
		expect(second.id).toBe(first.id);
		expect((await api.listMoodLogs()).filter((item) => item.id === id)).toHaveLength(1);
	});

	it('moves an application on the kanban and rejects an unknown status', async () => {
		const api = new MockQingxinApi();
		await api.login('demo@qingxin.app', 'qingxin');
		const created = await api.createApplication({ company: '轻心实验室', position: '前端工程师' });
		expect(created.status).toBe('投递');
		const moved = await api.patchApplication(created.id, { status: '面试', notes: '问了盒模型' });
		expect(moved.status).toBe('面试');
		await expect(
			api.patchApplication(created.id, { status: '归档' as '投递' })
		).rejects.toMatchObject({
			code: 'invalid_request'
		});
		const funnel = await api.getHustleFunnel();
		expect(funnel.stages.map((item) => item.status)).toEqual(['投递', '面试', 'Offer']);
	});

	it('creates resume versions and stubs optimize behind a disclaimer', async () => {
		const api = new MockQingxinApi();
		await api.login('demo@qingxin.app', 'qingxin');
		const resume = await api.createResume({
			title: '投后端',
			content: { name: '林轻心', title: '后端工程师' }
		});
		expect(resume.version).toBeGreaterThanOrEqual(2);
		await expect(api.createResume({ content: { title: '没有姓名' } })).rejects.toMatchObject({
			code: 'invalid_request'
		});
		const insight = await api.optimizeResume(resume.id);
		expect(insight.source).toBe('mock');
		expect(insight.disclaimer).toContain('不构成');
		expect(insight.text).toContain('林轻心');
	});

	it('filters questions and returns a mock interviewer follow-up', async () => {
		const api = new MockQingxinApi();
		await api.login('demo@qingxin.app', 'qingxin');
		const front = await api.listHustleQuestions({ role: '前端' });
		expect(front.length).toBeGreaterThan(0);
		expect(front.every((item) => item.role === '前端')).toBe(true);
		const reply = await api.mockInterview({ questionId: front[0]?.id });
		expect(reply.source).toBe('mock');
		expect(reply.text.length).toBeGreaterThan(4);
		const ideas = await api.suggestSideHustles({ skills: ['设计'], hoursPerWeek: 6 });
		expect(ideas.items.length).toBeGreaterThanOrEqual(2);
		expect(ideas.source).toBe('mock');
	});

	it('covers create studio generate titles polish outline and snippets', async () => {
		const api = new MockQingxinApi();
		await api.login('demo@qingxin.app', 'qingxin');
		await expect(
			api.generateCreateCopy({ platform: '微博' as '小红书', topic: 'x' })
		).rejects.toMatchObject({ code: 'invalid_request' });
		const gen = await api.generateCreateCopy({
			platform: '小红书',
			topic: '阳台种菜',
			keywords: ['番茄'],
			tone: '更幽默',
			length: '短'
		});
		expect(gen.source).toBe('mock');
		expect(gen.disclaimer).toContain('不构成');
		expect(gen.text).toContain('阳台种菜');
		const titles = await api.generateCreateTitles({ topic: '阳台种菜' });
		expect(titles.titles).toHaveLength(10);
		const polish = await api.polishCreateCopy({ text: '今天写周报', tone: '更幽默' });
		expect(polish.text).toContain('今天写周报');
		const outline = await api.generateCreateOutline({ topic: '季度复盘' });
		expect(outline.slides.length).toBeGreaterThanOrEqual(3);
		expect(outline.markdown).toContain('季度复盘');
		const templates = await api.listCreateTemplates('小红书');
		expect(templates.every((item) => item.platform === '小红书')).toBe(true);
		const work = await api.createCreation({
			platform: '周报',
			promptParams: { topic: '本周进展' },
			generatedContent: '进展一览',
			finalContent: '润色稿'
		});
		expect(work.finalContent).toBe('润色稿');
		expect(work.versions).toHaveLength(2);
		const patched = await api.patchCreation(work.id, { finalContent: '定稿' });
		expect(patched.versions.length).toBeGreaterThan(work.versions.length);
		const same = await api.patchCreation(work.id, { finalContent: '定稿' });
		expect(same.versions).toHaveLength(patched.versions.length);
		const snip = await api.createSnippet({ content: '先写结论。', kind: '过渡' });
		const used = await api.useSnippet(snip.id);
		expect(used.usageCount).toBe(1);
		const exported = await api.exportUserData();
		expect(exported.data.creations?.some((item) => item.id === work.id)).toBe(true);
		expect(exported.data.snippets?.some((item) => item.id === snip.id)).toBe(true);
	});

	it('lists seeded 宠物医院 and sorts by rating', async () => {
		const api = new MockQingxinApi();
		await api.login('demo@qingxin.app', 'qingxin');
		const found = await api.listLocalServices({ q: '宠物医院' });
		expect(found.length).toBeGreaterThan(0);
		expect(found.every((item) => item.name.includes('宠物医院'))).toBe(true);
		const ranked = await api.listLocalServices({ sort: 'rating' });
		const ratings = ranked.map((item) => item.ratingAvg);
		expect([...ratings].sort((a, b) => b - a)).toEqual(ratings);
		await expect(
			api.createLocalService({
				name: '夜店',
				category: '酒吧' as '维修',
				address: '静安区',
				latitude: 31.23,
				longitude: 121.47
			})
		).rejects.toMatchObject({ code: 'invalid_request' });
	});

	it('creates a review and rejects a 501-character note', async () => {
		const api = new MockQingxinApi();
		await api.login('demo@qingxin.app', 'qingxin');
		const [hospital] = await api.listLocalServices({ q: '宠物医院' });
		expect(hospital).toBeTruthy();
		const review = await api.createLocalReview(hospital!.id, { content: '医生很耐心', rating: 5 });
		expect(review.content).toBe('医生很耐心');
		await expect(
			api.createLocalReview(hospital!.id, { content: '字'.repeat(501) })
		).rejects.toMatchObject({ code: 'invalid_request' });
		const flag = await api.createLocalCorrection(hospital!.id, { kind: '电话空号' });
		expect(flag.kind).toBe('电话空号');
		const published = await api.createLocalService({
			name: '街角修伞铺',
			category: '维修',
			address: '轻心路 8 号',
			latitude: 31.2298,
			longitude: 121.4742
		});
		const exported = await api.exportUserData();
		expect(exported.data.localReviews?.some((item) => item.id === review.id)).toBe(true);
		expect(exported.data.localCorrections?.some((item) => item.id === flag.id)).toBe(true);
		expect(exported.data.localServices?.some((item) => item.id === published.id)).toBe(true);
	});
});

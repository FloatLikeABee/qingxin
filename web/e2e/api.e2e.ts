import { expect, test, type Page } from '@playwright/test';
import { webPushJobWrite } from '../src/lib/elder/payload';
import { nextOccurrenceIso } from '../src/lib/elder/schedule';

async function acceptPrivacy(page: Page) {
	await page.addInitScript(() => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
	});
}

async function registerFresh(page: Page) {
	const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
	const email = `e2e-${stamp}@qingxin.app`;
	const note = `e2e心情${stamp}`;
	await acceptPrivacy(page);
	await page.goto('/register');
	await page.getByLabel('称呼').fill('E2E同学');
	await page.getByLabel('邮箱').fill(email);
	await page.getByLabel('密码').fill('correct-horse');
	await page.getByRole('button', { name: '注册' }).click();
	await expect(page.getByText('已登录：E2E同学')).toBeVisible({ timeout: 15_000 });
	return { email, note };
}

test('register round-trips through the Rust API', async ({ page }) => {
	const { note } = await registerFresh(page);
	await expect(page.getByText('退出登录')).toBeVisible();
	await expect(page.getByRole('link', { name: '登录 / 注册' })).toHaveCount(0);

	await page.goto('/');
	await expect(page.locator('h1')).toBeVisible();

	await page.goto('/modules/mood');
	await expect(page.getByRole('heading', { name: '情绪日记' })).toBeVisible();
	await page.getByRole('button', { name: '很好' }).click();
	await page.getByLabel('一句备注（选填）').fill(note);
	await page.getByRole('button', { name: '记下这一刻' }).click();
	await expect(page.getByText(note)).toBeVisible({ timeout: 15_000 });

	await page.goto('/modules/local');
	await expect(page.getByRole('heading', { name: '本地生活' })).toBeVisible();
	await page.getByRole('button', { name: '列表' }).click();
	await expect(page.getByText('轻心宠物医院').first()).toBeVisible();
});

test('finance health pets study share shell chrome', async ({ page }) => {
	await registerFresh(page);
	await page.setViewportSize({ width: 1280, height: 800 });

	await page.goto('/finance');
	await expect(page.locator('aside')).toBeVisible();
	await expect(page.getByRole('heading', { name: '财务' })).toBeVisible();
	await expect(page.getByRole('link', { name: '返回模块中心' })).toBeVisible();

	await page.goto('/wellness');
	await expect(page.getByRole('heading', { name: '健康' })).toBeVisible();
	await expect(page.getByRole('link', { name: '返回模块中心' })).toBeVisible();

	await page.goto('/pets');
	await expect(page.getByRole('link', { name: '返回模块中心' })).toBeVisible();

	await page.goto('/study');
	await expect(page.getByRole('link', { name: '返回模块中心' })).toBeVisible();
});

test('salary, subscription, job, water, and elder modal use the live API', async ({ page }) => {
	await registerFresh(page);

	await page.goto('/finance/add');
	await page.getByRole('button', { name: '收入' }).click();
	for (const key of ['8', '8', '0', '0']) {
		await page.getByRole('group', { name: '金额键盘' }).getByRole('button', { name: key }).click();
	}
	await page.getByRole('button', { name: '下一步：选分类' }).click();
	await page.getByRole('button', { name: '工资' }).click();
	const posted = page.waitForResponse(
		(res) => res.url().includes('/v1/finance/transactions') && res.request().method() === 'POST'
	);
	await page.getByRole('button', { name: '确认记账' }).click();
	const txRes = await posted;
	expect(txRes.ok(), await txRes.text()).toBeTruthy();
	await expect(page.getByRole('heading', { name: '财务' })).toBeVisible({ timeout: 15_000 });
	await expect(page.getByText('工资').first()).toBeVisible();
	await expect(page.getByText('+¥8800.00')).toBeVisible();

	await page.goto('/finance/settings');
	await page.getByRole('button', { name: '添加订阅' }).click();
	await expect(page.getByText('音乐会员')).toBeVisible({ timeout: 15_000 });

	const apiUrl = process.env.PUBLIC_API_URL ?? 'http://127.0.0.1:8080';
	const token = await page.evaluate(() => {
		const raw = localStorage.getItem('qingxin.session');
		return raw ? ((JSON.parse(raw) as { token?: string }).token ?? null) : null;
	});
	expect(token).toBeTruthy();
	const jobBody = webPushJobWrite({
		runAt: nextOccurrenceIso('23:59', [1, 2, 3, 4, 5, 6, 7]),
		title: '续费提醒',
		body: '音乐会员'
	});
	const jobRes = await fetch(`${apiUrl}/v1/jobs`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
			Accept: 'application/json'
		},
		body: JSON.stringify(jobBody)
	});
	expect(jobRes.status).toBe(201);
	const jobJson = (await jobRes.json()) as { kind: string; payload: { title: string } };
	expect(jobJson.kind).toBe('web_push');
	expect(jobJson.payload.title).toBe('续费提醒');

	await page.goto('/wellness');
	await expect(page.getByRole('heading', { name: '健康' })).toBeVisible();
	await expect(page.getByText('0 / 2000 ml')).toBeVisible({ timeout: 15_000 });
	const waterPosted = page.waitForResponse(
		(res) => res.url().includes('/v1/wellness/water') && res.request().method() === 'POST'
	);
	await page.getByRole('button', { name: '+1 杯（250 ml）' }).click();
	const waterRes = await waterPosted;
	expect(waterRes.ok(), await waterRes.text()).toBeTruthy();
	await expect(page.getByText('250 / 2000 ml')).toBeVisible({ timeout: 15_000 });

	await page.goto('/elder');
	await expect(page.getByRole('heading', { name: '今天先做这几件' })).toBeVisible();
	await expect(page.getByText('今天没有用药提醒。')).toBeVisible();
	await expect(page.locator('dialog[open]')).toHaveCount(0);
	await expect(page.getByRole('heading', { name: '该吃药了' })).toBeHidden();
});

test('create generate falls back to the zh-CN stub and hustle resume fits mobile', async ({
	page
}) => {
	await registerFresh(page);

	const generatePosted = page.waitForResponse(
		(res) => res.url().includes('/v1/create/generate') && res.request().method() === 'POST'
	);
	await page.goto('/modules/create');
	const generateRes = await generatePosted;
	expect(generateRes.status(), await generateRes.text()).toBe(200);
	expect(generateRes.status()).not.toBe(503);
	const generateJson = (await generateRes.json()) as { text?: string; source?: string };
	expect(generateJson.text?.trim()).toBeTruthy();
	if (generateJson.source !== 'gateway') {
		expect(generateJson.source).toBe('mock');
		expect(generateJson.text ?? '').toContain('示意文案');
	}
	await expect(page.getByRole('heading', { name: '内容创作' })).toBeVisible();
	await expect(page.locator('#create-final')).not.toHaveValue('');
	await expect(page.getByText('示意文案暂时不可用')).toHaveCount(0);
	await page.screenshot({ path: 'screenshots/create-http-editor-1280.png', fullPage: true });
	await page.getByRole('button', { name: '保存作品' }).click();
	await expect(page.getByText('已收进作品')).toBeVisible({ timeout: 15_000 });

	await page.goto('/modules/hustle');
	await expect(page.getByRole('heading', { name: '求职副业' })).toBeVisible();
	await page.getByRole('tab', { name: '求职' }).click();
	await page.getByRole('button', { name: '简历', exact: true }).click();
	await expect(page.getByText('A4 预览始终浅色').first()).toBeVisible();
	await page.screenshot({ path: 'screenshots/hustle-http-resume-1280.png', fullPage: true });

	await page.evaluate(() => {
		localStorage.setItem('qingxin.theme', 'dark');
		document.documentElement.classList.add('dark');
	});
	await page.setViewportSize({ width: 390, height: 844 });

	await page.goto('/modules/create');
	await expect(page.locator('#create-final')).not.toHaveValue('', { timeout: 15_000 });
	await expect(page.getByText('示意文案暂时不可用')).toHaveCount(0);
	await page.addStyleTag({ content: 'nav.fixed { position: static; }' });
	await page.screenshot({ path: 'screenshots/create-http-editor-390-dark.png', fullPage: true });

	await page.goto('/modules/hustle');
	await page.getByRole('tab', { name: '求职' }).click();
	await page.getByRole('button', { name: '简历', exact: true }).click();
	await expect(page.getByText('A4 预览始终浅色').first()).toBeVisible();
	await page.addStyleTag({ content: 'nav.fixed { position: static; }' });
	const shell = page.locator('.resume-a4-shell');
	await expect(shell).toBeVisible();
	const box = await shell.boundingBox();
	expect(box, 'A4 shell should have a box').toBeTruthy();
	expect(box!.width).toBeLessThanOrEqual(390);
	const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(scrollWidth).toBeLessThanOrEqual(392);
	const sheetBg = await page
		.locator('.resume-a4')
		.evaluate((el) => getComputedStyle(el).backgroundColor);
	expect(sheetBg.replace(/\s/g, '')).toMatch(/rgb\(255,255,255\)|#ffffff/i);
	await page.screenshot({ path: 'screenshots/hustle-http-resume-390-dark.png', fullPage: true });
});

test('AI toolbox streams through /v1/tools and persists history', async ({ page }) => {
	await registerFresh(page);
	await page.goto('/modules/ai');
	await expect(page.getByRole('heading', { name: 'AI效率工具箱' })).toBeVisible();
	await expect(page.getByText('全部工具')).toBeVisible();
	const summaryCard = page.locator('section').filter({ hasText: '全部工具' });
	await summaryCard.getByRole('button', { name: '收藏' }).first().click();
	await expect(page.getByText('已收藏')).toBeVisible({ timeout: 15_000 });
	await page.screenshot({ path: 'screenshots/tools-http-grid-1280.png', fullPage: true });

	await page.getByRole('tab', { name: '工作台' }).click();
	await expect(page.getByRole('button', { name: '停止' })).toBeVisible();
	await page.getByRole('button', { name: '开始' }).click();
	await expect(page.getByText(/思考中|示意摘要|待办/).first()).toBeVisible({ timeout: 15_000 });
	await expect(page.locator('pre')).toContainText(/示意|待办|摘要/, { timeout: 20_000 });
	await expect(page.getByRole('button', { name: '复制' })).toBeEnabled();
	await page.screenshot({ path: 'screenshots/tools-http-workbench-1280.png', fullPage: true });

	await page.getByRole('tab', { name: '历史' }).click();
	await expect(page.getByText('今天')).toBeVisible({ timeout: 15_000 });
	await expect(page.getByText(/示意|待办|摘要/).first()).toBeVisible();
	await page.getByRole('button', { name: '摘要' }).click();
	await expect(page.getByText('今天')).toBeVisible();
	await page.screenshot({ path: 'screenshots/tools-http-history-1280.png', fullPage: true });

	await page.setViewportSize({ width: 390, height: 844 });
	await page.addStyleTag({ content: 'nav.fixed { position: static; }' });
	await page.getByRole('tab', { name: '工具' }).click();
	await expect(page.getByText('已收藏')).toBeVisible();
	await page.screenshot({ path: 'screenshots/tools-http-grid-390.png', fullPage: true });
	await page.getByRole('tab', { name: '工作台' }).click();
	await expect(page.locator('pre')).toContainText(/示意|待办|摘要/);
	await page.screenshot({ path: 'screenshots/tools-http-workbench-390.png', fullPage: true });
	await page.getByRole('tab', { name: '历史' }).click();
	await expect(page.getByText('今天')).toBeVisible();
	await page.screenshot({ path: 'screenshots/tools-http-history-390.png', fullPage: true });
});

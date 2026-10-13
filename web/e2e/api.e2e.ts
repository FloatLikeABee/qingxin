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
	await page.getByRole('button', { name: '+1 杯（250 ml）' }).click();
	await expect(page.getByText('250 / 2000 ml')).toBeVisible({ timeout: 15_000 });

	await page.goto('/elder');
	await expect(page.getByRole('heading', { name: '今天先做这几件' })).toBeVisible();
	await expect(page.getByText('今天没有用药提醒。')).toBeVisible();
	await expect(page.locator('dialog[open]')).toHaveCount(0);
	await expect(page.getByRole('heading', { name: '该吃药了' })).toBeHidden();
});

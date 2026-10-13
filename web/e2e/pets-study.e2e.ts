import { expect, test, type Page } from '@playwright/test';

async function acceptPrivacy(page: Page) {
	await page.addInitScript(() => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
	});
}

async function registerFresh(page: Page) {
	const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
	const email = `pets-study-${stamp}@qingxin.app`;
	await acceptPrivacy(page);
	await page.goto('/register');
	await page.getByLabel('称呼').fill('豆豆家长');
	await page.getByLabel('邮箱').fill(email);
	await page.getByLabel('密码').fill('correct-horse');
	await page.getByRole('button', { name: '注册' }).click();
	await expect(page.getByText('已登录：豆豆家长')).toBeVisible({ timeout: 15_000 });
}

test('adding a pet saves through the API and survives reload', async ({ page }) => {
	await registerFresh(page);
	await page.goto('/pets');
	await expect(page.getByRole('heading', { name: '宠物' })).toBeVisible();
	await expect(page.getByText('还没有毛孩子')).toBeVisible();

	await page.getByLabel('名字').fill('豆豆');
	await page.getByRole('button', { name: '添加宠物' }).click();
	await expect(page.getByRole('heading', { name: '豆豆' })).toBeVisible({ timeout: 15_000 });
	await expect(page.getByText('还没有毛孩子')).toHaveCount(0);

	await page.reload();
	await expect(page.getByRole('heading', { name: '豆豆' })).toBeVisible({ timeout: 15_000 });

	await page.getByRole('button', { name: '打卡' }).first().click();
	await expect(page.getByText('喂食 · 已完成 1')).toBeVisible({ timeout: 15_000 });

	await page.getByRole('link', { name: '打开档案' }).click();
	await expect(page.getByRole('heading', { name: '豆豆' })).toBeVisible();
	await page.getByLabel('克').fill('4200');
	await page.getByRole('button', { name: '记下体重' }).click();
	await expect(page.getByText('4.20 kg')).toBeVisible({ timeout: 15_000 });
});

test('study challenge check-in and flashcard review hit the API', async ({ page }) => {
	await registerFresh(page);
	await page.goto('/study');
	await expect(page.getByText('还没有挑战')).toBeVisible();

	await page.goto('/study/checkin');
	await page.getByLabel('名称').fill('背单词');
	await page.getByRole('button', { name: '21 天' }).click();
	await page.getByRole('button', { name: '开始挑战' }).click();
	await expect(page.getByRole('heading', { name: '背单词' })).toBeVisible({ timeout: 15_000 });
	await page.getByRole('button', { name: '完成今日任务' }).click();
	await expect(page.getByRole('button', { name: '今日已完成' })).toBeVisible({ timeout: 15_000 });
	await expect(page.getByText('1 天连续')).toBeVisible();

	await page.goto('/study');
	await expect(page.getByRole('heading', { name: '背单词' })).toBeVisible({ timeout: 15_000 });
	await expect(page.getByText('今日已打卡')).toBeVisible();
	await expect(page.getByText('1 天连续')).toBeVisible();

	await page.goto('/study/cards');
	await page.getByLabel('正面').fill('过去分词');
	await page.getByLabel('背面').fill('done');
	await page.getByRole('button', { name: '加入卡片' }).click();
	await expect(page.getByText('过去分词')).toBeVisible({ timeout: 15_000 });
	await page.getByRole('button', { name: '记得' }).click();
	await expect(page.getByText(/间隔 1 天/)).toBeVisible({ timeout: 15_000 });
});

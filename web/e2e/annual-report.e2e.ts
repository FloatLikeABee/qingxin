import { expect, test, type Page } from '@playwright/test';

test.use({
	video: { mode: 'on', size: { width: 1280, height: 800 } }
});

async function boot(page: Page) {
	await page.addInitScript(() => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem('qingxin.theme', 'dark');
		if (!sessionStorage.getItem('qingxin.keepReport')) {
			localStorage.removeItem('qingxin.games.annual-report');
		}
	});
}

type Box = { x: number; y: number; width: number; height: number };

function boxesOverlap(a: Box, b: Box, slop = 1) {
	return (
		a.x + slop < b.x + b.width &&
		a.x + a.width > b.x + slop &&
		a.y + slop < b.y + b.height &&
		a.y + a.height > b.y + slop
	);
}

async function assertHudClear(page: Page) {
	const back = await page.locator('[data-hud="back"]').boundingBox();
	const actions = await page.locator('[data-hud="actions"]').boundingBox();
	const mark = await page.locator('[data-hud="mark"]').boundingBox();
	expect(back).toBeTruthy();
	expect(actions).toBeTruthy();
	expect(mark).toBeTruthy();
	expect(boxesOverlap(back!, actions!), '返回目录 overlaps 撤销').toBe(false);
	expect(boxesOverlap(back!, mark!), '返回目录 overlaps disclaimer').toBe(false);
}

async function openPlay(page: Page) {
	await boot(page);
	await page.goto('/modules/games', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: '经营' }).click();
	await page.locator('a.game-card').filter({ hasText: '年报' }).click();
	await expect(page.getByRole('heading', { name: '年报', level: 1 })).toBeVisible();
	await expect(page.getByText(/不是真实财报/)).toBeVisible();
	await page.getByRole('link', { name: '打开年报' }).click();
	await expect(page).toHaveURL(/\/modules\/games\/annual-report\/play/);
	await expect(page.locator('[data-play="report"]')).toBeVisible();
}

test.describe('年报', () => {
	test('guest edits assumptions and the three statements move', async ({ page, context }) => {
		test.setTimeout(120_000);
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await page.setViewportSize({ width: 1280, height: 800 });
		await openPlay(page);
		await expect(page.locator('[data-hud="mark"]')).toHaveText(/不是真实财报，也不连接 Excel/);
		await expect(page.getByRole('tab', { name: '假设' })).toBeVisible();
		await expect(page.getByRole('tab', { name: '利润表' })).toBeVisible();
		await expect(page.getByRole('tab', { name: '资产负债表' })).toBeVisible();
		await expect(page.getByRole('tab', { name: '现金流量表' })).toBeVisible();
		await expect(page.getByLabel('公式栏')).toBeVisible();
		await assertHudClear(page);
		const grid = page.locator('[data-play="report"]');
		const ni0 = Number(await grid.getAttribute('data-ni'));
		const cash0 = Number(await grid.getAttribute('data-cash'));
		const assets0 = Number(await grid.getAttribute('data-assets'));
		await page.locator('[data-cell="C6"]').click();
		await grid.focus();
		await page.keyboard.press('ArrowDown');
		await expect(grid).toHaveAttribute('data-addr', 'C7');
		await page.locator('[data-cell="C6"]').click();
		await page.getByLabel('公式栏').fill('=0.12+0.23');
		await page.getByRole('button', { name: '写入' }).click();
		await expect.poll(async () => Number(await grid.getAttribute('data-growth'))).toBeCloseTo(0.35);
		await expect(page.locator('[data-cell="C6"]')).toHaveAttribute('data-kind', 'formula');
		await expect.poll(async () => Number(await grid.getAttribute('data-ni'))).not.toBe(ni0);
		await expect.poll(async () => Number(await grid.getAttribute('data-cash'))).not.toBe(cash0);
		await expect.poll(async () => Number(await grid.getAttribute('data-assets'))).not.toBe(assets0);
		await page.screenshot({ path: 'screenshots/annual-report-assume-1280.png' });

		await page.getByRole('tab', { name: '利润表' }).click();
		await expect(grid).toHaveAttribute('data-sheet', '利润表');
		await expect(page.getByText('净利润').first()).toBeVisible();
		await page.locator('[data-cell="C5"]').click();
		await expect(page.getByLabel('公式栏')).toHaveValue('=B5*(1+假设!C6)');
		await page.screenshot({ path: 'screenshots/annual-report-formula-1280.png' });
		await page.screenshot({ path: 'screenshots/annual-report-income-1280.png' });

		await page.getByRole('tab', { name: '资产负债表' }).click();
		await expect(page.getByText('勾稽差额').first()).toBeVisible();
		await expect
			.poll(async () => Math.abs(Number(await grid.getAttribute('data-tie'))))
			.toBeLessThan(2);

		await page.getByRole('tab', { name: '现金流量表' }).click();
		await expect(page.getByText('期末现金').first()).toBeVisible();

		await page.getByRole('tab', { name: '假设' }).click();
		await page.locator('[data-cell="B3"]').click();
		await page.getByLabel('公式栏').fill('=1/0');
		await page.getByRole('button', { name: '写入' }).click();
		await expect(page.locator('[data-cell="B3"]')).toHaveAttribute('data-kind', 'error');
		await expect(page.locator('[data-cell="B3"]')).toHaveText('#DIV/0!');
		await page.screenshot({ path: 'screenshots/annual-report-error-1280.png' });

		await page.locator('[data-cell="B7"]').click();
		await page.evaluate(async () => navigator.clipboard.writeText('13000\t0.5'));
		await page.getByRole('button', { name: '粘贴' }).click();
		await expect(page.locator('[data-cell="B7"]')).toHaveText('13000');
		await expect(page.locator('[data-cell="C7"]')).toHaveText('0.5');
		await page.getByRole('button', { name: '撤销' }).click();
		await expect(page.locator('[data-cell="B7"]')).not.toHaveText('13000');
		await page.getByRole('button', { name: '重做' }).click();
		await expect(page.locator('[data-cell="B7"]')).toHaveText('13000');
		await page.getByRole('button', { name: '撤销' }).click();

		await page.locator('[data-cell="C6"]').click();
		await page.getByRole('button', { name: '%' }).click();
		await expect(page.locator('[data-cell="C6"]')).toContainText('%');

		await page.evaluate(() => sessionStorage.setItem('qingxin.keepReport', '1'));
		const growth = await grid.getAttribute('data-growth');
		await page.reload({ waitUntil: 'networkidle' });
		const grid2 = page.locator('[data-play="report"]');
		await expect.poll(async () => grid2.getAttribute('data-growth')).toBe(growth);
		await expect(page.locator('[data-cell="C6"]')).toContainText('%');
		await expect(page.locator('[data-cell="B3"]')).toHaveText('#DIV/0!');

		await page.setViewportSize({ width: 390, height: 844 });
		await expect(page.getByRole('tab', { name: '假设' })).toBeVisible();
		await assertHudClear(page);
		await page.locator('[data-cell="C6"]').click();
		await page.getByLabel('公式栏').fill('0.18');
		await page.getByRole('button', { name: '写入' }).click();
		await expect
			.poll(async () => Number(await grid2.getAttribute('data-growth')))
			.toBeCloseTo(0.18);
		await page.getByRole('tab', { name: '利润表' }).click();
		await page.evaluate(() => {
			const body = document.querySelector('[data-play="report"]');
			const head = document.querySelector('.grid-head');
			if (body instanceof HTMLElement) {
				body.scrollLeft = 240;
				body.scrollTop = 0;
			}
			if (head instanceof HTMLElement) head.scrollLeft = 240;
		});
		await expect
			.poll(
				async () =>
					(await page.locator('[data-play="report"]').evaluate((el) => el.scrollLeft)) > 20
			)
			.toBe(true);
		await expect(page.locator('.grid-head').getByText('A', { exact: true })).toBeVisible();
		await expect(page.getByText('营业收入').first()).toBeVisible();
		await page.screenshot({ path: 'screenshots/annual-report-mobile-390.png' });
		await page.getByRole('link', { name: '← 返回目录' }).click();
		await expect(page).toHaveURL(/\/modules\/games$/);
	});

	test('sibling catalog games still boot', async ({ page }) => {
		test.setTimeout(120_000);
		await boot(page);
		await page.setViewportSize({ width: 1280, height: 800 });
		const routes: [string, string][] = [
			['/modules/games/convenient-store/play', '便利店三维店面'],
			['/modules/games/tide-breath/play', '潮汐呼吸夜海'],
			['/modules/games/cloud-walk/play', '云上散步天空'],
			['/modules/games/memory-shelf/play', '记忆货架书房'],
			['/modules/games/cargo-haul/play', '重卡公路'],
			['/modules/games/shangban/play', '轻心大厦']
		];
		for (const [path, label] of routes) {
			await page.goto(path, { waitUntil: 'networkidle' });
			const canvas = page.locator(`canvas[aria-label="${label}"]`);
			await expect(canvas).toBeVisible();
			await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
		}
	});
});

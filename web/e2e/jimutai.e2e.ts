import { expect, test, type Page } from '@playwright/test';

test.use({
	video: { mode: 'on', size: { width: 390, height: 844 } }
});

type JimutaiHook = {
	getState: () => {
		placed: number;
		tray: number;
		batchIndex: number;
		selected: number;
		notice: string;
	};
	placeAt: (x: number, y: number, z: number) => boolean;
	screenOf: (cell: { x: number; y: number; z: number }) => { x: number; y: number } | null;
};

async function guestBoot(page: Page, theme: 'light' | 'dark' = 'light') {
	await page.addInitScript((nextTheme) => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem('qingxin.theme', nextTheme);
		(window as Window & { __qingxinE2E?: boolean }).__qingxinE2E = true;
	}, theme);
}

async function openPlay(page: Page) {
	await page.goto('/modules/jimutai', { waitUntil: 'networkidle' });
	await expect(page.locator('[data-jimutai="1"]')).toBeVisible();
	await expect(page).toHaveTitle(/积木台/);
	const canvas = page.locator('canvas[aria-label="积木台"]');
	await expect(canvas).toBeVisible();
	await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-tray', '5');
	await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-placed', '0');
}

async function screenOf(page: Page, cell: { x: number; y: number; z: number }) {
	return page.evaluate((next) => {
		return (
			(window as Window & { __qingxinJimutai?: JimutaiHook }).__qingxinJimutai?.screenOf(next) ??
			null
		);
	}, cell);
}

async function clickCell(page: Page, cell: { x: number; y: number; z: number }) {
	await expect.poll(async () => screenOf(page, cell)).toBeTruthy();
	const at = await screenOf(page, cell);
	expect(at).toBeTruthy();
	await page.mouse.click(at!.x, at!.y);
}

const firstBatch = [
	{ x: 6, y: 0, z: 6 },
	{ x: 9, y: 0, z: 6 },
	{ x: 6, y: 0, z: 9 },
	{ x: 9, y: 0, z: 9 },
	{ x: 12, y: 0, z: 6 }
];

const secondBatch = [
	{ x: 6, y: 0, z: 3 },
	{ x: 9, y: 0, z: 3 },
	{ x: 3, y: 0, z: 6 },
	{ x: 3, y: 0, z: 9 },
	{ x: 12, y: 0, z: 9 }
];

test.describe('积木台', () => {
	test('guest builds through two five-piece batches with pointer, undo, reload', async ({
		page
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await guestBoot(page, 'light');
		await openPlay(page);
		const canvas = page.locator('canvas[aria-label="积木台"]');
		await expect(canvas).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
		await expect(page.getByRole('option', { name: /方块/ })).toBeVisible();
		await expect(page.locator('nav.fixed')).toHaveCount(0);
		await page.getByRole('option', { name: /长条/ }).click();
		await page.getByRole('button', { name: '旋转' }).click();
		await page.getByRole('button', { name: '倾斜' }).click();
		await page.getByRole('option', { name: /方块/ }).click();

		for (let i = 0; i < 4; i++) {
			await clickCell(page, firstBatch[i]!);
			await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute(
				'data-placed',
				String(i + 1),
				{ timeout: 8_000 }
			);
			await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-tray', String(4 - i));
			await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-batch', '0');
		}
		await clickCell(page, firstBatch[4]!);
		await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-placed', '5', {
			timeout: 8_000
		});
		await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-tray', '5');
		await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-batch', '1');
		await expect(page.getByText('又来了五块')).toBeVisible();

		await page.getByRole('button', { name: '撤销' }).click();
		await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-placed', '4');
		await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-tray', '1');
		await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-batch', '0');

		await clickCell(page, firstBatch[4]!);
		await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-placed', '5');
		await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-tray', '5');
		await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-batch', '1');

		for (let i = 0; i < 5; i++) {
			await clickCell(page, secondBatch[i]!);
			await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute(
				'data-placed',
				String(6 + i),
				{ timeout: 8_000 }
			);
		}
		await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-placed', '10');
		await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-tray', '5');
		await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-batch', '2');

		await page.screenshot({ path: 'screenshots/jimutai-built-390-light.png' });

		const trayBefore = await page.locator('[data-jimutai="1"]').getAttribute('data-tray');
		const placedBefore = await page.locator('[data-jimutai="1"]').getAttribute('data-placed');
		const overlapped = await page.evaluate(() => {
			return (window as Window & { __qingxinJimutai?: JimutaiHook }).__qingxinJimutai?.placeAt(
				6,
				0,
				6
			);
		});
		expect(overlapped).toBe(false);
		await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute(
			'data-tray',
			trayBefore ?? '5'
		);
		await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute(
			'data-placed',
			placedBefore ?? '10'
		);

		const box = await canvas.boundingBox();
		expect(box).toBeTruthy();
		await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.4);
		await page.mouse.down();
		await page.mouse.move(box!.x + box!.width * 0.5 + 48, box!.y + box!.height * 0.4, {
			steps: 8
		});
		await page.mouse.up();
		await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-placed', '10');

		await page.getByRole('button', { name: '清空积木台' }).click();
		await expect(page.getByRole('dialog', { name: '清空积木台' })).toBeVisible();
		await page.getByRole('button', { name: '取消' }).click();
		await expect(page.getByRole('dialog', { name: '清空积木台' })).toHaveCount(0);
		await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-placed', '10');

		await page.reload({ waitUntil: 'networkidle' });
		await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-placed', '10', {
			timeout: 20_000
		});
		await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-tray', '5');
		await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-batch', '2');

		await page.setViewportSize({ width: 1280, height: 800 });
		await expect(canvas).toBeVisible();
		await page.screenshot({ path: 'screenshots/jimutai-built-1280-light.png' });
	});

	test('390 and 1280 light/dark show a built table', async ({ page }) => {
		for (const view of [
			{ width: 390, height: 844, name: '390' },
			{ width: 1280, height: 800, name: '1280' }
		] as const) {
			for (const theme of ['light', 'dark'] as const) {
				await page.setViewportSize({ width: view.width, height: view.height });
				await guestBoot(page, theme);
				await page.goto('/offline', { waitUntil: 'domcontentloaded' });
				await page.evaluate(() => localStorage.removeItem('qingxin.jimutai'));
				await openPlay(page);
				await expect(page.locator('canvas[aria-label="积木台"]')).toHaveAttribute(
					'data-ready',
					'1',
					{ timeout: 20_000 }
				);
				for (const cell of [...firstBatch, ...secondBatch]) {
					await clickCell(page, cell);
				}
				await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-placed', '10', {
					timeout: 20_000
				});
				await page.screenshot({
					path: `screenshots/jimutai-built-${view.name}-${theme}.png`
				});
			}
		}
	});

	test.describe('touch', () => {
		test.use({ hasTouch: true });

		test('tap places a piece on a phone-sized canvas', async ({ page }) => {
			await page.setViewportSize({ width: 390, height: 844 });
			await guestBoot(page);
			await openPlay(page);
			await expect(page.locator('canvas[aria-label="积木台"]')).toHaveAttribute('data-ready', '1', {
				timeout: 20_000
			});
			await expect.poll(async () => screenOf(page, { x: 8, y: 0, z: 8 })).toBeTruthy();
			const point = await screenOf(page, { x: 8, y: 0, z: 8 });
			expect(point).toBeTruthy();
			await page.touchscreen.tap(point!.x, point!.y);
			await expect(page.locator('[data-jimutai="1"]')).toHaveAttribute('data-placed', '1', {
				timeout: 8_000
			});
		});
	});

	test('hub lists 积木台 instead of retired modules', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await guestBoot(page);

		await page.goto('/modules', { waitUntil: 'networkidle' });
		await expect(page.getByRole('heading', { name: '积木台' })).toBeVisible();
		await expect(page.getByRole('heading', { name: '本地生活' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'AI效率工具箱' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: '学习打卡' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: '求职副业' })).toHaveCount(0);
		await page.goto('/modules/local');
		await expect(page.getByText('本地生活已经从轻心主入口撤下')).toBeVisible();
		await expect(page.getByRole('button', { name: '列表' })).toHaveCount(0);
	});
});

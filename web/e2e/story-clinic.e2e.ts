import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({
	video: { mode: 'on', size: { width: 1280, height: 800 } }
});

const HERBS = [
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

const FORBIDDEN = /疗效|主治|治愈|mg|适应症/;

async function boot(page: Page, theme: 'light' | 'dark' = 'light') {
	await page.addInitScript((nextTheme) => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem('qingxin.theme', nextTheme);
		if (!sessionStorage.getItem('qingxin.keepClinic')) {
			localStorage.removeItem('qingxin.games.story-clinic');
		}
	}, theme);
}

async function waitClinic(page: Page) {
	const hall = page.locator('canvas[aria-label="中医馆候诊厅"]');
	await expect(hall).toBeVisible();
	await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
	await expect.poll(async () => hall.getAttribute('data-px'), { timeout: 15_000 }).not.toBeNull();
	return hall;
}

async function ackClinic(page: Page) {
	const gate = page.getByRole('dialog', { name: '中医馆' });
	await expect(gate).toBeVisible();
	await expect(gate.getByText(/病例都是编的/)).toBeVisible();
	await gate.getByRole('button', { name: '我明白，开始虚构接诊' }).click();
	await expect(page.locator('.clinic-play')).toHaveAttribute('data-ack', '1');
}

async function dualShot(page: Page, hall: Locator, name: string) {
	await page.setViewportSize({ width: 1280, height: 800 });
	await expect.poll(async () => (await hall.boundingBox())?.width ?? 0).toBeGreaterThan(400);
	await expect.poll(async () => hall.getAttribute('data-inbox'), { timeout: 8_000 }).toBe('1');
	await page.screenshot({ path: `screenshots/${name}-1280.png` });
	await page.setViewportSize({ width: 390, height: 844 });
	await expect.poll(async () => (await hall.boundingBox())?.width ?? 0).toBeLessThan(500);
	await expect.poll(async () => hall.getAttribute('data-inbox'), { timeout: 8_000 }).toBe('1');
	await page.screenshot({ path: `screenshots/${name}-390.png` });
	await page.setViewportSize({ width: 1280, height: 800 });
	await expect.poll(async () => (await hall.boundingBox())?.width ?? 0).toBeGreaterThan(400);
	await expect.poll(async () => hall.getAttribute('data-inbox'), { timeout: 8_000 }).toBe('1');
}

async function canvasPoint(hall: Locator, xKey: string, yKey: string) {
	const box = await hall.boundingBox();
	if (!box) throw new Error('canvas box');
	const x = Number(await hall.getAttribute(`data-${xKey}`));
	const y = Number(await hall.getAttribute(`data-${yKey}`));
	if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`bad ${xKey}/${yKey}`);
	return { x: box.x + x, y: box.y + y };
}

async function assertReachable(page: Page, hall: Locator) {
	const box = await hall.boundingBox();
	expect(box).toBeTruthy();
	const pad = 16;
	await expect(hall).toHaveAttribute('data-inbox', '1');
	const who = await canvasPoint(hall, 'px', 'py');
	expect(who.x - box!.x).toBeGreaterThan(pad);
	expect(who.x - box!.x).toBeLessThan(box!.width - pad);
	expect(who.y - box!.y).toBeGreaterThan(pad);
	expect(who.y - box!.y).toBeLessThan(box!.height - pad);
	await expect(page.locator('[data-patient-label]')).toBeVisible();
	for (const id of HERBS) {
		const pt = await canvasPoint(hall, `jx-${id}`, `jy-${id}`);
		expect(pt.x - box!.x, `${id} x`).toBeGreaterThan(pad);
		expect(pt.x - box!.x, `${id} x`).toBeLessThan(box!.width - pad);
		expect(pt.y - box!.y, `${id} y`).toBeGreaterThan(pad);
		expect(pt.y - box!.y, `${id} y`).toBeLessThan(box!.height - pad);
		const tag = page.locator(`[data-jar-label="${id}"]`);
		await expect(tag).toBeVisible();
		const tbox = await tag.boundingBox();
		expect(tbox).toBeTruthy();
		expect(tbox!.width).toBeGreaterThanOrEqual(44);
		expect(tbox!.height).toBeGreaterThanOrEqual(44);
	}
}

function alongScreenRight(
	from: { x: number; lookx: number; lookz: number; z: number },
	to: { x: number; z: number }
) {
	return (to.x - from.x) * -from.lookz + (to.z - from.z) * from.lookx;
}

test.describe('中医馆', () => {
	test('catalog 中医馆 opens a hall, examines, prescribes, and recovers', async ({ page }) => {
		test.setTimeout(180_000);
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page);
		await page.goto('/modules/games', { waitUntil: 'networkidle' });
		await page.getByLabel('找一款想玩的').fill('医院');
		await expect(page.getByRole('heading', { name: '中医馆' }).first()).toBeVisible();
		await expect(page.getByRole('heading', { name: '医馆', exact: true })).toHaveCount(0);
		await page.getByRole('heading', { name: '中医馆' }).first().click();
		await expect(page).toHaveURL(/\/modules\/games\/story-clinic$/);
		await expect(page.getByRole('heading', { name: '中医馆', level: 1 })).toBeVisible();
		await expect(page.getByText('Hospital')).toBeVisible();
		await expect(page.getByText(/虚构娱乐，不是诊疗/)).toBeVisible();
		await page.getByRole('link', { name: '开始接诊' }).click();
		await expect(page).toHaveURL(/\/modules\/games\/story-clinic\/play/);
		await ackClinic(page);
		const hall = await waitClinic(page);
		await expect(
			page.getByText('虚构娱乐，不是诊疗，没有真实剂量，不能当医嘱。').first()
		).toBeVisible();
		await expect(page.getByRole('timer')).toHaveCount(0);
		await assertReachable(page, hall);
		await dualShot(page, hall, 'story-clinic-hall');

		for (let i = 0; i < 4; i++) await page.getByRole('button', { name: '往下听' }).click();
		await expect.poll(async () => hall.getAttribute('data-tags'), { timeout: 8_000 }).toBe('3');
		await page.getByRole('button', { name: '望' }).click();
		await expect(page.locator('[data-story-tags]')).toHaveText(/怕风/);
		await dualShot(page, hall, 'story-clinic-examine');

		await page.getByRole('button', { name: '抓药' }).click();
		await expect.poll(async () => hall.getAttribute('data-notice')).toMatch(/还没选药/);

		await page.getByRole('button', { name: '写纸条' }).click();
		await page.locator('#clinic-slip').fill('给狐狸一包暖手的气味，不是医嘱。');
		await page.locator('[data-jar-label="danggui"]').click();
		await page.locator('[data-jar-label="juhua"]').click();
		await expect.poll(async () => hall.getAttribute('data-jars')).toBe('2');
		await dualShot(page, hall, 'story-clinic-prescribe');
		await page.getByRole('button', { name: '抓药' }).click();
		await expect
			.poll(async () => hall.getAttribute('data-phase'), { timeout: 8_000 })
			.toBe('dispense');
		await page.getByRole('button', { name: '暂停' }).click();
		await dualShot(page, hall, 'story-clinic-dispense');
		await page.getByRole('button', { name: '继续' }).click();
		await expect
			.poll(async () => hall.getAttribute('data-phase'), { timeout: 8_000 })
			.toBe('recovery');
		await expect
			.poll(async () => Number(await hall.getAttribute('data-score')))
			.toBeGreaterThanOrEqual(2);
		await expect(page.locator('[data-recovery]')).toHaveText(/怕风|夜咳/);
		await expect(page.locator('.clinic-play')).not.toHaveText(FORBIDDEN);
		await dualShot(page, hall, 'story-clinic-recovery');

		await page.evaluate(() => sessionStorage.setItem('qingxin.keepClinic', '1'));
		await page.reload({ waitUntil: 'networkidle' });
		await expect(page.locator('.clinic-play')).toHaveAttribute('data-ack', '1');
		const again = await waitClinic(page);
		await expect(again).toHaveAttribute('data-ack', '1');
	});

	test('390 jar chips stay 44px and operation keeps its own warning', async ({ page }) => {
		test.setTimeout(90_000);
		await page.setViewportSize({ width: 390, height: 844 });
		await boot(page);
		await page.goto('/modules/games/story-clinic/play', { waitUntil: 'networkidle' });
		await ackClinic(page);
		const hall = await waitClinic(page);
		await expect(hall).toHaveAttribute('data-narrow', '1');
		await assertReachable(page, hall);
		const look = page.getByRole('button', { name: '望' });
		const box = await look.boundingBox();
		expect(box).toBeTruthy();
		expect(box!.height).toBeGreaterThanOrEqual(44);
		expect(box!.width).toBeGreaterThanOrEqual(44);
		await page.screenshot({ path: 'screenshots/story-clinic-touch-390.png' });

		await page.goto('/modules/games/operation/play', { waitUntil: 'networkidle' });
		await expect(page.locator('[data-play="operation"]')).toHaveAttribute('data-view', 'warning');
		await expect(page.getByRole('button', { name: '我已知晓，进入手术' })).toBeVisible();
		await expect(page.getByRole('button', { name: '我明白，开始虚构接诊' })).toHaveCount(0);
	});

	test('kitchen cargo cloud operation shelf and other siblings still boot', async ({ page }) => {
		test.setTimeout(120_000);
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'dark');

		await page.goto('/modules/games/home-kitchen/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[aria-label="家庭厨房灶台"]')).toHaveAttribute(
			'data-ready',
			'1',
			{
				timeout: 20_000
			}
		);

		await page.goto('/modules/games/cargo-haul/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[aria-label="重卡公路"]')).toHaveAttribute('data-ready', '1', {
			timeout: 20_000
		});

		await page.goto('/modules/games/cloud-walk/play', { waitUntil: 'networkidle' });
		const sky = page.locator('canvas[aria-label="云上散步天空"]');
		await expect(sky).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
		await expect
			.poll(async () => sky.getAttribute('data-lookx'), { timeout: 8_000 })
			.not.toBeNull();
		const idle = await sky.evaluate((el) => ({
			x: Number(el.getAttribute('data-x')),
			z: Number(el.getAttribute('data-z')),
			lookx: Number(el.getAttribute('data-lookx')),
			lookz: Number(el.getAttribute('data-lookz'))
		}));
		await page.locator('[data-play="cloud"]').evaluate((el) => (el as HTMLElement).focus());
		await page.keyboard.down('ArrowRight');
		await expect
			.poll(
				async () => {
					const next = await sky.evaluate((el) => ({
						x: Number(el.getAttribute('data-x')),
						z: Number(el.getAttribute('data-z'))
					}));
					return alongScreenRight(idle, next);
				},
				{ timeout: 6_000 }
			)
			.toBeGreaterThan(0.4);
		await page.keyboard.up('ArrowRight');

		await page.goto('/modules/games/operation/play', { waitUntil: 'networkidle' });
		await expect(page.locator('[data-play="operation"]')).toBeVisible();

		await page.goto('/modules/games/memory-shelf/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[aria-label="记忆货架书房"]')).toHaveAttribute(
			'data-ready',
			'1',
			{
				timeout: 20_000
			}
		);

		await page.goto('/modules/games/annual-report/play', { waitUntil: 'networkidle' });
		await expect(page.getByRole('tab', { name: '假设' })).toBeVisible();
		await page.goto('/modules/games/tide-breath/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
		await page.goto('/modules/games/convenient-store/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[aria-label="便利店三维店面"]')).toHaveAttribute(
			'data-ready',
			'1',
			{ timeout: 20_000 }
		);
		await page.goto('/modules/games/shangban/play', { waitUntil: 'networkidle' });
		await expect(page.getByRole('link', { name: '← 返回目录' })).toBeVisible();
	});
});

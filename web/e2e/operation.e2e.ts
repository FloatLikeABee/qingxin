import { expect, test, type Page } from '@playwright/test';

test.use({
	video: { mode: 'on', size: { width: 1280, height: 800 } }
});

async function boot(page: Page, theme: 'light' | 'dark' = 'dark') {
	await page.addInitScript((nextTheme) => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem('qingxin.theme', nextTheme);
		localStorage.setItem('qingxin.games.shelf', '{"ok":1}');
		localStorage.setItem('qingxin.games.cargo-haul', '{"schema":2}');
		localStorage.setItem('qingxin.games.cloud-walk', '{"schema":3}');
	}, theme);
}

async function shot(page: Page, name: string) {
	await page.screenshot({ path: `screenshots/${name}.png`, animations: 'disabled' });
}

function playRoot(page: Page) {
	return page.locator('div[data-play="operation"]');
}

async function waitCanvas(page: Page) {
	const canvas = page.locator('canvas[data-play="operation"]');
	await expect(canvas).toBeVisible({ timeout: 20_000 });
	await expect(canvas).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
	return canvas;
}

async function canvasBox(page: Page) {
	const canvas = await waitCanvas(page);
	const box = await canvas.boundingBox();
	expect(box).toBeTruthy();
	return box!;
}

async function dragUv(page: Page, x0: number, y0: number, x1: number, y1: number) {
	const box = await canvasBox(page);
	await page.mouse.move(box.x + x0 * box.width, box.y + y0 * box.height);
	await page.mouse.down();
	for (let i = 1; i <= 16; i++) {
		const t = i / 16;
		await page.mouse.move(
			box.x + (x0 + (x1 - x0) * t) * box.width,
			box.y + (y0 + (y1 - y0) * t) * box.height
		);
	}
	await page.mouse.up();
}

async function target(page: Page) {
	const root = playRoot(page);
	const x = Number((await root.getAttribute('data-target-x')) ?? '0.5');
	const y = Number((await root.getAttribute('data-target-y')) ?? '0.5');
	return { x, y };
}

async function waitPhase(page: Page, phase: string) {
	await expect(playRoot(page)).toHaveAttribute('data-phase', phase, { timeout: 15_000 });
}

async function ackAndHub(page: Page) {
	await page.goto('/modules/games/operation/play', { waitUntil: 'networkidle' });
	await expect(playRoot(page)).toHaveAttribute('data-view', 'warning');
	await expect(page.locator('canvas[data-play="operation"]')).toHaveCount(0);
	await page.getByRole('button', { name: '我已知晓，进入手术' }).click();
	await expect(playRoot(page)).toHaveAttribute('data-view', 'hub', { timeout: 15_000 });
	await waitCanvas(page);
}

async function enterRegion(page: Page, name: string, id: string) {
	await page.getByRole('button', { name }).click();
	await expect(playRoot(page)).toHaveAttribute('data-view', 'field');
	await expect(playRoot(page)).toHaveAttribute('data-region', id);
	await waitCanvas(page);
}

async function useTool(page: Page, label: string) {
	await page.locator(`[data-hud="tray"] button:has-text("${label}")`).click();
}

async function cutThenSew(page: Page, shots?: { cut?: string; sew?: string; end?: string }) {
	await expect(playRoot(page)).toHaveAttribute('data-phase', 'cut');
	await useTool(page, '刀');
	const t = await target(page);
	await dragUv(page, 0.16, t.y, 0.86, t.y);
	if ((await playRoot(page).getAttribute('data-phase')) !== 'sew') {
		await dragUv(page, 0.16, t.y, 0.86, t.y);
	}
	await waitPhase(page, 'sew');
	if (shots?.cut) {
		await page.waitForTimeout(180);
		await shot(page, shots.cut);
	}
	await useTool(page, '缝针');
	const t2 = await target(page);
	if (shots?.sew) {
		await page.waitForTimeout(120);
		await shot(page, shots.sew);
	}
	await dragUv(page, 0.16, t2.y, 0.86, t2.y);
	if ((await playRoot(page).getAttribute('data-complete')) !== '1') {
		await dragUv(page, 0.16, t2.y, 0.86, t2.y);
	}
	await expect(playRoot(page)).toHaveAttribute('data-complete', '1', { timeout: 8_000 });
	await expect(playRoot(page)).toHaveAttribute('data-phase', 'done');
	if (shots?.end) await shot(page, shots.end);
}

test.describe('手术', () => {
	test('catalog cover is nongraphic and warning gates direct play', async ({ page }) => {
		test.setTimeout(60_000);
		await boot(page);
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/modules/games', { waitUntil: 'networkidle' });
		await page.getByLabel('找一款想玩的').fill('手术');
		await expect(page.getByRole('heading', { name: '手术' }).first()).toBeVisible();
		await shot(page, 'operation-catalog-1280');
		await page.locator('a.game-card').filter({ hasText: '手术' }).click();
		await expect(page.getByRole('heading', { name: '手术', level: 1 })).toBeVisible();
		await expect(page.getByText(/写实手术画面/)).toBeVisible();
		await expect(page.getByText(/切开/)).toBeVisible();
		await expect(page.getByText(/缝合/)).toBeVisible();
		await shot(page, 'operation-detail-1280');
		await page.goto('/modules/games/operation/play', { waitUntil: 'networkidle' });
		await expect(playRoot(page)).toHaveAttribute('data-view', 'warning');
		await expect(page.locator('canvas')).toHaveCount(0);
		await shot(page, 'operation-warning-1280');
		await page.getByRole('button', { name: '我已知晓，进入手术' }).click();
		await expect(playRoot(page)).toHaveAttribute('data-view', 'hub');
		await waitCanvas(page);
		await expect(page.locator('canvas[data-graphic="1"]')).toHaveCount(0);
		await expect(page.getByText('胸 未开放')).toBeVisible();
		await shot(page, 'operation-hub-1280');
		const keys = await page.evaluate(() => ({
			op: localStorage.getItem('qingxin.games.operation'),
			shelf: localStorage.getItem('qingxin.games.shelf'),
			theme: localStorage.getItem('qingxin.theme'),
			cargo: localStorage.getItem('qingxin.games.cargo-haul'),
			cloud: localStorage.getItem('qingxin.games.cloud-walk')
		}));
		expect(keys.shelf).toBe('{"ok":1}');
		expect(keys.theme).toBe('dark');
		expect(keys.cargo).toBe('{"schema":2}');
		expect(keys.cloud).toBe('{"schema":3}');
		expect(keys.op).toContain('"graphicAck":true');
		expect(keys.op).toContain('"schema":2');
		expect(keys.op).not.toContain('"complete":true');
		await page.reload({ waitUntil: 'networkidle' });
		await expect(playRoot(page)).toHaveAttribute('data-view', 'hub');
		await expect(page.getByRole('button', { name: '我已知晓，进入手术' })).toHaveCount(0);
	});

	test('forearm cut then sew, wrong tool stays non-blocking, pause works', async ({ page }) => {
		test.setTimeout(90_000);
		await boot(page);
		await page.setViewportSize({ width: 1280, height: 800 });
		await ackAndHub(page);
		await enterRegion(page, '前臂', 'forearm');
		await expect(page.getByRole('button', { name: '吸引' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: '冲洗' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: '纱布' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: '挺子' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: '镊' })).toHaveCount(0);
		await useTool(page, '缝针');
		const t = await target(page);
		await dragUv(page, 0.2, t.y, 0.8, t.y);
		await expect(playRoot(page).locator('[data-hud="notice"]')).toContainText(/现在不能用|请用刀/);
		await expect(playRoot(page)).toHaveAttribute('data-phase', 'cut');
		const beforeBleed = Number((await playRoot(page).getAttribute('data-bleed')) ?? '0');
		await cutThenSew(page, {
			cut: 'operation-forearm-blood-1280',
			sew: 'operation-forearm-tool-1280',
			end: 'operation-forearm-closed-1280'
		});
		const after = Number((await playRoot(page).getAttribute('data-bleed')) ?? '0');
		expect(after).toBeGreaterThanOrEqual(beforeBleed);
		await page.getByRole('button', { name: '细腻' }).click();
		await page.waitForTimeout(180);
		await shot(page, 'operation-forearm-lowdetail-1280');
		await page.getByRole('button', { name: '低细腻' }).click();
		await page.getByRole('button', { name: '暂停' }).click();
		await expect(playRoot(page)).toHaveAttribute('data-paused', '1');
		await page.getByRole('button', { name: '继续' }).click();
		await expect(playRoot(page)).toHaveAttribute('data-paused', '0');
	});

	test('knee, tooth, and belly complete with the same two path gestures', async ({ page }) => {
		test.setTimeout(180_000);
		await boot(page);
		await page.setViewportSize({ width: 1280, height: 800 });
		await ackAndHub(page);
		await enterRegion(page, '膝', 'knee');
		await cutThenSew(page, { cut: 'operation-knee-field-1280', end: 'operation-knee-closed-1280' });
		await page.getByRole('button', { name: '身体图' }).click();
		await expect(playRoot(page)).toHaveAttribute('data-view', 'hub');
		await enterRegion(page, '口腔', 'tooth');
		await cutThenSew(page, { cut: 'operation-tooth-field-1280', end: 'operation-tooth-closed-1280' });
		await page.getByRole('button', { name: '身体图' }).click();
		await enterRegion(page, '腹', 'belly');
		await cutThenSew(page, { cut: 'operation-belly-field-1280', end: 'operation-belly-closed-1280' });
	});

	test('mobile 390 warning, hub, active cut/sew, 44px tools', async ({ page }) => {
		test.setTimeout(120_000);
		await boot(page, 'light');
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/modules/games/operation/play', { waitUntil: 'networkidle' });
		await expect(playRoot(page)).toHaveAttribute('data-view', 'warning');
		await shot(page, 'operation-warning-390');
		await page.getByRole('button', { name: '我已知晓，进入手术' }).click();
		await expect(playRoot(page)).toHaveAttribute('data-view', 'hub');
		await waitCanvas(page);
		await shot(page, 'operation-hub-390');
		const back = await page.locator('[data-hud="back"]').boundingBox();
		const mark = await page.locator('[data-hud="mark"]').boundingBox();
		expect(back && mark).toBeTruthy();
		expect(
			back!.x + 1 < mark!.x + mark!.width &&
				back!.x + back!.width > mark!.x + 1 &&
				back!.y + 1 < mark!.y + mark!.height &&
				back!.y + back!.height > mark!.y + 1
		).toBe(false);

		await enterRegion(page, '前臂', 'forearm');
		await shot(page, 'operation-forearm-390');
		const knife = page.locator('[data-hud="tray"] button:has-text("刀")');
		const needle = page.locator('[data-hud="tray"] button:has-text("缝针")');
		const kBox = await knife.boundingBox();
		const nBox = await needle.boundingBox();
		expect(kBox).toBeTruthy();
		expect(nBox).toBeTruthy();
		expect(kBox!.height).toBeGreaterThanOrEqual(44);
		expect(kBox!.width).toBeGreaterThanOrEqual(44);
		expect(nBox!.height).toBeGreaterThanOrEqual(44);
		expect(nBox!.width).toBeGreaterThanOrEqual(44);
		await useTool(page, '刀');
		const t = await target(page);
		await dragUv(page, 0.16, t.y, 0.86, t.y);
		await waitPhase(page, 'sew');
		await shot(page, 'operation-forearm-field-390');
		await useTool(page, '缝针');
		await dragUv(page, 0.16, t.y, 0.86, t.y);
		if ((await playRoot(page).getAttribute('data-complete')) !== '1') {
			await dragUv(page, 0.16, t.y, 0.86, t.y);
		}
		await expect(playRoot(page)).toHaveAttribute('data-complete', '1', { timeout: 8_000 });
		await shot(page, 'operation-forearm-complete-390');
		await page.getByRole('button', { name: '暂停' }).click();
		await expect(playRoot(page)).toHaveAttribute('data-paused', '1');
		await shot(page, 'operation-forearm-pause-390');
		await page.getByRole('button', { name: '继续' }).click();
	});

	test('reduced motion keeps blood materials and skips spray', async ({ page }) => {
		test.setTimeout(60_000);
		await boot(page);
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.setViewportSize({ width: 1280, height: 800 });
		await ackAndHub(page);
		await enterRegion(page, '前臂', 'forearm');
		await expect(playRoot(page)).toHaveAttribute('data-reduced', '1');
		await useTool(page, '刀');
		const p = await target(page);
		await dragUv(page, 0.16, p.y, 0.86, p.y);
		await waitPhase(page, 'sew');
		expect(Number((await playRoot(page).getAttribute('data-bleed')) ?? '0')).toBeGreaterThan(8);
		await expect(playRoot(page)).toHaveAttribute('data-spray', '0');
		await shot(page, 'operation-forearm-reduced-1280');
	});

	test('reload without ack never mounts the field', async ({ page }) => {
		await boot(page);
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/modules/games/operation/play', { waitUntil: 'networkidle' });
		await page.reload({ waitUntil: 'networkidle' });
		await expect(playRoot(page)).toHaveAttribute('data-view', 'warning');
		await expect(page.locator('canvas')).toHaveCount(0);
	});

	test('schema 1 save keeps ack and stars; field restarts at cut', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('qingxin.privacyConsent', 'accepted');
			localStorage.setItem('qingxin.theme', 'dark');
			localStorage.setItem(
				'qingxin.games.operation',
				JSON.stringify({
					schema: 1,
					graphicAck: true,
					stars: { forearm: 2, knee: 0, tooth: 0, belly: 0 },
					lastSeed: 4,
					audioWanted: false,
					lessSpray: false,
					lowDetail: false,
					dockCollapsed: false,
					phase: 'hemostasis',
					tool: 'suction'
				})
			);
		});
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/modules/games/operation/play', { waitUntil: 'networkidle' });
		await expect(playRoot(page)).toHaveAttribute('data-view', 'hub');
		await expect(page.getByRole('button', { name: '我已知晓，进入手术' })).toHaveCount(0);
		await enterRegion(page, '前臂', 'forearm');
		await expect(playRoot(page)).toHaveAttribute('data-phase', 'cut');
		await expect(playRoot(page)).toHaveAttribute('data-tool', 'scalpel');
	});

	test('sibling truck and cloud still boot', async ({ page }) => {
		await boot(page);
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/modules/games/cargo-haul/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[aria-label="重卡公路"]')).toBeVisible();
		await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
		await page.goto('/modules/games/cloud-walk/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[aria-label="云上散步天空"]')).toBeVisible();
		await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
	});
});

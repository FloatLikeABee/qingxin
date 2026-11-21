import { expect, test, type Page } from '@playwright/test';

test.use({
	video: { mode: 'on', size: { width: 1280, height: 800 } }
});

async function boot(page: Page, theme: 'light' | 'dark' = 'dark') {
	await page.addInitScript((nextTheme) => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem('qingxin.theme', nextTheme);
		localStorage.setItem('qingxin.games.shelf', '{"ok":1}');
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
	for (let i = 1; i <= 12; i++) {
		const t = i / 12;
		await page.mouse.move(
			box.x + (x0 + (x1 - x0) * t) * box.width,
			box.y + (y0 + (y1 - y0) * t) * box.height
		);
	}
	await page.mouse.up();
}

async function holdUv(page: Page, x: number, y: number, ms = 1400) {
	const box = await canvasBox(page);
	await page.mouse.move(box.x + x * box.width, box.y + y * box.height);
	await page.mouse.down();
	await page.waitForTimeout(ms);
	await page.mouse.up();
}

async function pickUv(page: Page, x: number, y: number) {
	const box = await canvasBox(page);
	await page.mouse.move(box.x + x * box.width, box.y + y * box.height);
	await page.mouse.down();
	await page.waitForTimeout(280);
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
	await page.getByRole('button', { name: name }).click();
	await expect(playRoot(page)).toHaveAttribute('data-view', 'field');
	await expect(playRoot(page)).toHaveAttribute('data-region', id);
	await waitCanvas(page);
}

async function useTool(page: Page, label: string) {
	await page.locator(`[data-hud="tray"] button:has-text("${label}")`).click();
}

async function completeRegion(
	page: Page,
	name: string,
	id: string,
	steps: Array<{ tool: string; gesture: 'hold' | 'path' | 'pick'; dual?: string }>,
	shots?: { mid?: string; end?: string }
) {
	if ((await playRoot(page).getAttribute('data-view')) !== 'hub') {
		await page.getByRole('button', { name: '身体图' }).click();
		await expect(playRoot(page)).toHaveAttribute('data-view', 'hub');
	}
	await enterRegion(page, name, id);
	const phases = ['prepare', 'expose', 'operate', 'hemostasis', 'close', 'done'];
	const gesture = async (step: (typeof steps)[number]) => {
		const t = await target(page);
		if (id === 'belly' && step.dual === '取袋') {
			const n = Number((await playRoot(page).getAttribute('data-stones')) ?? '1');
			for (let s = 0; s < n; s++) {
				const sx = 0.4 + s * 0.1;
				await useTool(page, '抓钳');
				await pickUv(page, sx, t.y);
				await useTool(page, '取袋');
				await pickUv(page, sx, t.y);
			}
			return;
		}
		await useTool(page, step.tool);
		if (step.gesture === 'hold') await holdUv(page, t.x, t.y, 1400);
		else if (step.gesture === 'path') await dragUv(page, 0.18, t.y, 0.84, t.y);
		else await pickUv(page, t.x, t.y);
		if (step.dual) {
			await useTool(page, step.dual);
			await dragUv(page, 0.18, t.y, 0.84, t.y);
		}
	};
	for (let i = 0; i < steps.length; i++) {
		const step = steps[i]!;
		const next = phases[i + 1]!;
		if ((await playRoot(page).getAttribute('data-phase')) === next) continue;
		await gesture(step);
		if ((await playRoot(page).getAttribute('data-phase')) !== next) {
			await gesture(step);
		}
		await expect(playRoot(page)).toHaveAttribute('data-phase', next, { timeout: 8_000 });
		if (next === 'operate' && shots?.mid) {
			await page.waitForTimeout(250);
			await shot(page, shots.mid);
		}
	}
	await expect(playRoot(page)).toHaveAttribute('data-phase', 'done', { timeout: 8_000 });
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
			theme: localStorage.getItem('qingxin.theme')
		}));
		expect(keys.shelf).toBe('{"ok":1}');
		expect(keys.theme).toBe('dark');
		expect(keys.op).toContain('"graphicAck":true');
		expect(keys.op).not.toContain('"complete":true');
		await page.reload({ waitUntil: 'networkidle' });
		await expect(playRoot(page)).toHaveAttribute('data-view', 'hub');
		await expect(page.getByRole('button', { name: '我已知晓，进入手术' })).toHaveCount(0);
	});

	test('forearm cut raises bleed, suction lowers it, then close', async ({ page }) => {
		test.setTimeout(90_000);
		await boot(page);
		await page.setViewportSize({ width: 1280, height: 800 });
		await ackAndHub(page);
		await enterRegion(page, '前臂', 'forearm');
		await useTool(page, '刀');
		await dragUv(page, 0.2, 0.5, 0.8, 0.5);
		await expect(playRoot(page).locator('[data-hud="notice"]')).toContainText('现在不能用');
		await expect(playRoot(page)).toHaveAttribute('data-phase', 'prepare');
		await useTool(page, '纱布');
		{
			const p = await target(page);
			await holdUv(page, p.x, p.y, 1400);
		}
		await waitPhase(page, 'expose');
		const beforeBleed = Number((await playRoot(page).getAttribute('data-bleed')) ?? '0');
		await useTool(page, '刀');
		const t = await target(page);
		await dragUv(page, 0.2, t.y, 0.82, t.y);
		await waitPhase(page, 'operate');
		const cutBleed = Number((await playRoot(page).getAttribute('data-bleed')) ?? '0');
		expect(cutBleed).toBeGreaterThan(beforeBleed);
		await page.waitForTimeout(250);
		await shot(page, 'operation-forearm-blood-1280');
		await shot(page, 'operation-forearm-tool-1280');
		await page.getByRole('button', { name: '细腻' }).click();
		await page.waitForTimeout(200);
		await shot(page, 'operation-forearm-lowdetail-1280');
		await page.getByRole('button', { name: '低细腻' }).click();
		await useTool(page, '镊');
		await pickUv(page, t.x, t.y);
		await waitPhase(page, 'hemostasis');
		await useTool(page, '吸引');
		await holdUv(page, t.x, t.y, 1400);
		await waitPhase(page, 'close');
		const afterSuction = Number((await playRoot(page).getAttribute('data-bleed')) ?? '0');
		expect(afterSuction).toBeLessThan(cutBleed);
		await useTool(page, '缝针');
		await dragUv(page, 0.2, t.y, 0.82, t.y);
		await expect(playRoot(page)).toHaveAttribute('data-phase', 'done');
		await shot(page, 'operation-forearm-closed-1280');
		await page.getByRole('button', { name: '暂停' }).click();
		await expect(playRoot(page)).toHaveAttribute('data-paused', '1');
	});

	test('knee completes with wrap', async ({ page }) => {
		test.setTimeout(120_000);
		await boot(page);
		await page.setViewportSize({ width: 1280, height: 800 });
		await ackAndHub(page);
		await completeRegion(
			page,
			'膝',
			'knee',
			[
				{ tool: '纱布', gesture: 'hold' },
				{ tool: '刀', gesture: 'path' },
				{ tool: '冲洗', gesture: 'hold' },
				{ tool: '纱布', gesture: 'hold' },
				{ tool: '缝针', gesture: 'path', dual: '绷带' }
			],
			{ mid: 'operation-knee-field-1280', end: 'operation-knee-closed-1280' }
		);
	});

	test('tooth completes with pack', async ({ page }) => {
		test.setTimeout(90_000);
		await boot(page);
		await page.setViewportSize({ width: 1280, height: 800 });
		await ackAndHub(page);
		await completeRegion(
			page,
			'口腔',
			'tooth',
			[
				{ tool: '吸引', gesture: 'hold' },
				{ tool: '挺子', gesture: 'path' },
				{ tool: '镊', gesture: 'pick' },
				{ tool: '纱布', gesture: 'hold' },
				{ tool: '纱布', gesture: 'hold' }
			],
			{ mid: 'operation-tooth-field-1280', end: 'operation-tooth-closed-1280' }
		);
	});

	test('belly bags stones and closes', async ({ page }) => {
		test.setTimeout(120_000);
		await boot(page);
		await page.setViewportSize({ width: 1280, height: 800 });
		await ackAndHub(page);
		await completeRegion(
			page,
			'腹',
			'belly',
			[
				{ tool: '吸引', gesture: 'hold' },
				{ tool: '刀', gesture: 'path' },
				{ tool: '抓钳', gesture: 'pick', dual: '取袋' },
				{ tool: '吸引', gesture: 'hold' },
				{ tool: '缝针', gesture: 'path' }
			],
			{ mid: 'operation-belly-field-1280', end: 'operation-belly-closed-1280' }
		);
	});

	test('mobile 390 warning, hub, gesture, pause, and no HUD overlap', async ({ page }) => {
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
		await useTool(page, '纱布');
		const t = await target(page);
		await holdUv(page, t.x, t.y);
		await waitPhase(page, 'expose');
		await useTool(page, '刀');
		await dragUv(page, 0.2, t.y, 0.82, t.y);
		await waitPhase(page, 'operate');
		await page.waitForTimeout(250);
		await shot(page, 'operation-forearm-field-390');
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
		await useTool(page, '纱布');
		{
			const p = await target(page);
			await holdUv(page, p.x, p.y, 1400);
		}
		await waitPhase(page, 'expose');
		await useTool(page, '刀');
		{
			const p = await target(page);
			await dragUv(page, 0.2, p.y, 0.82, p.y);
		}
		await waitPhase(page, 'operate');
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
});

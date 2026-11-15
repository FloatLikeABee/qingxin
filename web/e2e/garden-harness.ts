import { expect, type Page } from '@playwright/test';

export type GardenSnap = {
	selected: number;
	paused: boolean;
	beds: Array<{ id: number; plantId: string | null; stage: string }>;
};

type GardenTest = {
	tick: (n: number) => void;
	potClient: (id: number) => { x: number; y: number } | null;
	snapshot: () => GardenSnap;
	spawnPest: (bedId: number) => void;
	select: (id: number) => void;
	setPaused: (paused: boolean) => void;
};

export async function bootGarden(page: Page, theme: 'light' | 'dark' = 'light') {
	await page.addInitScript((nextTheme) => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem('qingxin.theme', nextTheme);
		localStorage.setItem(
			'qingxin.session',
			JSON.stringify({
				userId: 'user-demo',
				displayName: '轻心同学',
				email: 'demo@qingxin.app',
				token: 'mock-token-demo'
			})
		);
		if (!sessionStorage.getItem('qingxin.keepGarden')) {
			localStorage.removeItem('qingxin.games.window-garden');
		}
		(window as { __qingxinE2E?: boolean }).__qingxinE2E = true;
	}, theme);
}

export async function waitGarden(page: Page) {
	await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
	await page.waitForFunction(
		() =>
			Boolean((window as { __qingxinGardenTest?: GardenTest }).__qingxinGardenTest?.potClient(0)),
		undefined,
		{ timeout: 20_000 }
	);
}

export async function gardenSnap(page: Page): Promise<GardenSnap> {
	return page.evaluate(() => {
		const api = (window as { __qingxinGardenTest?: GardenTest }).__qingxinGardenTest;
		if (!api) throw new Error('garden test hook missing');
		return api.snapshot();
	});
}

export async function gardenTick(page: Page, n: number) {
	await page.evaluate((steps) => {
		const api = (window as { __qingxinGardenTest?: GardenTest }).__qingxinGardenTest;
		if (!api) throw new Error('garden test hook missing');
		api.tick(steps);
	}, n);
}

export async function gardenPause(page: Page, paused: boolean) {
	await page.evaluate((next) => {
		const api = (window as { __qingxinGardenTest?: GardenTest }).__qingxinGardenTest;
		if (!api) throw new Error('garden test hook missing');
		api.setPaused(next);
	}, paused);
}

export async function spawnPest(page: Page, bedId: number) {
	await page.evaluate((id) => {
		const api = (window as { __qingxinGardenTest?: GardenTest }).__qingxinGardenTest;
		if (!api) throw new Error('garden test hook missing');
		api.spawnPest(id);
	}, bedId);
}

export async function tapPot(page: Page, id: number) {
	const pt = await page.evaluate((bedId) => {
		const api = (window as { __qingxinGardenTest?: GardenTest }).__qingxinGardenTest;
		if (!api) throw new Error('garden test hook missing');
		return api.potClient(bedId);
	}, id);
	if (!pt) throw new Error(`pot ${id} has no screen point`);
	await page.mouse.click(pt.x, pt.y);
	await expect.poll(async () => (await gardenSnap(page)).selected).toBe(id);
	return pt;
}

export async function plantOnPot(page: Page, id: number, name: string) {
	await tapPot(page, id);
	await page.getByRole('button', { name, exact: true }).click();
	await page.getByRole('button', { name: `种下${name}` }).click();
	await expect.poll(async () => (await gardenSnap(page)).beds[id]?.plantId).not.toBeNull();
}

export async function assertPotsAboveDock(page: Page) {
	const dock = page.locator('[data-garden-dock]');
	const canvas = page.locator('canvas[aria-label="窗前庭园"]');
	const dockBox = await dock.boundingBox();
	const canvasBox = await canvas.boundingBox();
	if (!dockBox || !canvasBox) throw new Error('dock or canvas box missing');
		expect(canvasBox.y + canvasBox.height).toBeLessThanOrEqual(dockBox.y + 16);
	for (let id = 0; id < 12; id++) {
		const pt = await page.evaluate((bedId) => {
			const api = (window as { __qingxinGardenTest?: GardenTest }).__qingxinGardenTest;
			if (!api) throw new Error('garden test hook missing');
			return api.potClient(bedId);
		}, id);
		if (!pt) throw new Error(`pot ${id} missing`);
		expect(pt.y, `pot ${id} y`).toBeGreaterThan(canvasBox.y + 8);
		expect(pt.x, `pot ${id} x`).toBeGreaterThan(canvasBox.x);
		expect(pt.x, `pot ${id} x right`).toBeLessThan(canvasBox.x + canvasBox.width);
		expect(pt.y, `pot ${id} below dock`).toBeLessThan(dockBox.y - 8);
	}
}

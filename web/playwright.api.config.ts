import { defineConfig } from '@playwright/test';

const apiUrl = process.env.PUBLIC_API_URL ?? 'http://127.0.0.1:8080';

export default defineConfig({
	webServer: {
		command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
		url: 'http://127.0.0.1:4173',
		timeout: 180_000,
		reuseExistingServer: !process.env.CI,
		env: { ...process.env, PUBLIC_API_URL: apiUrl }
	},
	use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 1280, height: 800 } },
	testMatch: '**/api.e2e.ts',
	timeout: 60_000
});

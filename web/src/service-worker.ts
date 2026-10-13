/// <reference lib="webworker" />
import { assets, immutable, prerendered } from '$app/manifest';
import { version } from '$app/env';
import { asset, resolve } from '$app/paths';
import { self } from '$app/service-worker';

const CACHE = `qingxin-shell-${version}`;
const OFFLINE_PATH = resolve('/offline');

const SHELL = [
	...immutable.map((file) => file.path),
	...assets.map((file) => asset(file.path)),
	...prerendered.map((file) => (file.path === '' ? resolve('/') : `/${file.path}`)),
	OFFLINE_PATH,
	'/offline.html',
	'/fallback.html'
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll([...new Set(SHELL)]);
			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== location.origin) return;

	if (request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					const fresh = await fetch(request);
					const cache = await caches.open(CACHE);
					void cache.put(request, fresh.clone());
					return fresh;
				} catch {
					const cache = await caches.open(CACHE);
					return (
						(await cache.match(url.pathname)) ??
						(await cache.match(OFFLINE_PATH)) ??
						(await cache.match('/offline.html')) ??
						new Response('离线', {
							status: 503,
							headers: { 'Content-Type': 'text/plain; charset=utf-8' }
						})
					);
				}
			})()
		);
		return;
	}

	if (SHELL.includes(url.pathname) || SHELL.includes(url.href)) {
		event.respondWith(
			caches.open(CACHE).then(async (cache) => {
				const cached = await cache.match(request);
				return cached ?? fetch(request);
			})
		);
	}
});

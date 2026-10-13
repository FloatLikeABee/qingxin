import { describe, expect, it } from 'vitest';
import { ApiError } from './types';
import { HttpQingxinApi } from './http';

function memoryStorage(initial: Record<string, string> = {}) {
	const store = new Map(Object.entries(initial));
	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => {
			store.set(key, value);
		},
		removeItem: (key: string) => {
			store.delete(key);
		}
	};
}

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

function emptyResponse(status: number): Response {
	return new Response(null, { status });
}

function sseResponse(body: string): Response {
	return new Response(body, {
		status: 200,
		headers: { 'Content-Type': 'text/event-stream' }
	});
}

const tokens = {
	access_token: 'access-1',
	refresh_token: 'refresh-1',
	token_type: 'Bearer',
	expires_in: 900,
	user: {
		id: 'user-1',
		email: 'ada@qingxin.app',
		display_name: 'Ada',
		created_at: '2026-10-13T00:00:00Z'
	}
};

describe('HttpQingxinApi', () => {
	it('registers with consent and stores the session', async () => {
		const calls: { url: string; init: RequestInit }[] = [];
		const api = new HttpQingxinApi({
			baseUrl: 'http://127.0.0.1:8080/',
			storage: memoryStorage(),
			fetch: async (input, init) => {
				calls.push({ url: String(input), init: init ?? {} });
				return jsonResponse(201, tokens);
			}
		});
		const session = await api.register('Ada', 'ada@qingxin.app', 'correct-horse');
		expect(session).toMatchObject({
			userId: 'user-1',
			displayName: 'Ada',
			email: 'ada@qingxin.app',
			token: 'access-1',
			refreshToken: 'refresh-1'
		});
		const body = JSON.parse(String(calls[0]?.init.body));
		expect(calls[0]?.url).toBe('http://127.0.0.1:8080/v1/auth/register');
		expect(body).toMatchObject({
			email: 'ada@qingxin.app',
			password: 'correct-horse',
			display_name: 'Ada',
			consent: { policy_version: '2026-10-13' }
		});
		await expect(api.getSession()).resolves.toMatchObject({ userId: 'user-1' });
	});

	it('logs in against /v1/auth/login and reads /v1/me', async () => {
		const calls: string[] = [];
		const api = new HttpQingxinApi({
			baseUrl: 'http://127.0.0.1:8080',
			storage: memoryStorage(),
			fetch: async (input) => {
				const url = String(input);
				calls.push(url);
				if (url.endsWith('/v1/auth/login')) return jsonResponse(200, tokens);
				if (url.endsWith('/v1/me')) {
					return jsonResponse(200, {
						id: 'user-1',
						email: 'ada@qingxin.app',
						display_name: 'Ada',
						created_at: '2026-10-13T00:00:00Z'
					});
				}
				return jsonResponse(404, { error: { code: 'not_found', message: 'no' } });
			}
		});
		await api.login('ada@qingxin.app', 'correct-horse');
		const restored = new HttpQingxinApi({
			baseUrl: 'http://127.0.0.1:8080',
			storage: memoryStorage({
				'qingxin.session': JSON.stringify({
					userId: 'user-1',
					displayName: 'Ada',
					email: 'ada@qingxin.app',
					token: 'access-1',
					refreshToken: 'refresh-1'
				})
			}),
			fetch: async (input, init) => {
				expect(String(input)).toBe('http://127.0.0.1:8080/v1/me');
				expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer access-1');
				return jsonResponse(200, {
					id: 'user-1',
					email: 'ada@qingxin.app',
					display_name: 'Ada',
					created_at: '2026-10-13T00:00:00Z'
				});
			}
		});
		await expect(restored.getSession()).resolves.toMatchObject({ displayName: 'Ada' });
		expect(calls[0]).toBe('http://127.0.0.1:8080/v1/auth/login');
	});

	it('returns null from getSession when nothing is stored', async () => {
		const api = new HttpQingxinApi({
			baseUrl: 'http://127.0.0.1:8080',
			storage: memoryStorage(),
			fetch: async () => {
				throw new Error('network should not run');
			}
		});
		await expect(api.getSession()).resolves.toBeNull();
	});

	it('keeps a stored session when /v1/me is temporarily unavailable', async () => {
		const storage = memoryStorage({
			'qingxin.session': JSON.stringify({
				userId: 'user-1',
				displayName: 'Ada',
				email: 'ada@qingxin.app',
				token: 'access-1',
				refreshToken: 'refresh-1'
			})
		});
		const api = new HttpQingxinApi({
			baseUrl: 'http://127.0.0.1:8080',
			storage,
			fetch: async () => jsonResponse(503, { error: { code: 'unavailable', message: 'busy' } })
		});
		await expect(api.getSession()).resolves.toMatchObject({
			userId: 'user-1',
			token: 'access-1'
		});
		expect(storage.getItem('qingxin.session')).toContain('access-1');
	});

	it('clears the session when /v1/me is unauthenticated', async () => {
		const storage = memoryStorage({
			'qingxin.session': JSON.stringify({
				userId: 'user-1',
				displayName: 'Ada',
				email: 'ada@qingxin.app',
				token: 'access-1'
			})
		});
		const api = new HttpQingxinApi({
			baseUrl: 'http://127.0.0.1:8080',
			storage,
			fetch: async () =>
				jsonResponse(401, { error: { code: 'unauthenticated', message: '请先登录' } })
		});
		await expect(api.getSession()).resolves.toBeNull();
		expect(storage.getItem('qingxin.session')).toBeNull();
	});

	it('maps API errors to ApiError', async () => {
		const api = new HttpQingxinApi({
			baseUrl: 'http://127.0.0.1:8080',
			storage: memoryStorage(),
			fetch: async () =>
				jsonResponse(401, { error: { code: 'invalid_credentials', message: '账号或密码不正确' } })
		});
		await expect(api.login('ada@qingxin.app', 'nope')).rejects.toMatchObject({
			code: 'invalid_credentials'
		});
		await expect(api.login('ada@qingxin.app', 'nope')).rejects.toBeInstanceOf(ApiError);
	});

	it('refreshes once on 401 and retries the original request', async () => {
		const calls: string[] = [];
		const api = new HttpQingxinApi({
			baseUrl: 'http://127.0.0.1:8080',
			storage: memoryStorage({
				'qingxin.session': JSON.stringify({
					userId: 'user-1',
					displayName: 'Ada',
					email: 'ada@qingxin.app',
					token: 'old-access',
					refreshToken: 'refresh-1'
				})
			}),
			fetch: async (input, init) => {
				const url = String(input);
				calls.push(`${init?.method ?? 'GET'} ${url}`);
				if (
					url.endsWith('/v1/mood/logs') &&
					calls.filter((c) => c.includes('/v1/mood/logs')).length === 1
				) {
					return jsonResponse(401, {
						error: { code: 'unauthenticated', message: 'unauthenticated' }
					});
				}
				if (url.endsWith('/v1/auth/refresh')) {
					expect(JSON.parse(String(init?.body))).toEqual({ refresh_token: 'refresh-1' });
					return jsonResponse(200, {
						...tokens,
						access_token: 'access-2',
						refresh_token: 'refresh-2'
					});
				}
				if (url.endsWith('/v1/mood/logs')) {
					expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer access-2');
					return jsonResponse(200, {
						items: [
							{
								id: 'log-1',
								emoji: '😔',
								score: 2,
								tags: ['睡眠'],
								note: '夜里醒了两次',
								created_at: '2026-10-13T01:00:00Z'
							}
						]
					});
				}
				return jsonResponse(404, { error: { code: 'not_found', message: 'no' } });
			}
		});
		const logs = await api.listMoodLogs();
		expect(logs[0]).toMatchObject({ createdAt: '2026-10-13T01:00:00Z', note: '夜里醒了两次' });
		expect(calls).toEqual([
			'GET http://127.0.0.1:8080/v1/mood/logs',
			'POST http://127.0.0.1:8080/v1/auth/refresh',
			'GET http://127.0.0.1:8080/v1/mood/logs'
		]);
	});

	it('maps mood, hustle, local, and create snake_case fields', async () => {
		const api = new HttpQingxinApi({
			baseUrl: 'http://127.0.0.1:8080',
			storage: memoryStorage({
				'qingxin.session': JSON.stringify({
					userId: 'user-1',
					displayName: 'Ada',
					email: 'ada@qingxin.app',
					token: 'access-1',
					refreshToken: 'refresh-1'
				})
			}),
			fetch: async (input, init) => {
				const url = String(input);
				if (url.endsWith('/v1/mood/logs') && init?.method === 'POST') {
					const body = JSON.parse(String(init.body));
					expect(body).toMatchObject({ emoji: '🙂', tags: ['运动'], note: '散步' });
					return jsonResponse(201, {
						id: 'log-2',
						emoji: '🙂',
						score: 4,
						tags: ['运动'],
						note: '散步',
						created_at: '2026-10-13T02:00:00Z'
					});
				}
				if (url.endsWith('/v1/hustle/applications')) {
					return jsonResponse(200, {
						items: [
							{
								id: 'app-1',
								company: '轻心实验室',
								position: '前端',
								status: '面试',
								interview_date: '2026-10-20',
								notes: '带作品',
								created_at: '2026-10-01T00:00:00Z',
								updated_at: '2026-10-01T00:00:00Z'
							}
						]
					});
				}
				if (url.includes('/v1/local/services?')) {
					return jsonResponse(200, {
						items: [
							{
								id: 'svc-1',
								name: '轻心宠物医院',
								category: '宠物',
								latitude: 31.23,
								longitude: 121.47,
								address: '静安区轻心路 12 号',
								tags: ['有坡道'],
								rating_avg: 4.8,
								hero_key: 'pet',
								created_at: '2026-10-01T02:00:00Z',
								created_by: null,
								distance_m: 120,
								correction_counts: { 已搬迁: 0, 电话空号: 0 }
							}
						]
					});
				}
				if (url.endsWith('/v1/create/creations')) {
					return jsonResponse(200, {
						items: [
							{
								id: 'cr-1',
								platform: '小红书',
								title: '阳台种菜',
								prompt_params: { topic: '阳台种菜' },
								generated_content: '示意',
								final_content: '示意终稿',
								versions: [{ at: '2026-10-13T00:00:00Z', kind: 'generate', content: '示意' }],
								created_at: '2026-10-13T00:00:00Z',
								updated_at: '2026-10-13T00:00:00Z'
							}
						]
					});
				}
				return jsonResponse(404, { error: { code: 'not_found', message: url } });
			}
		});
		await expect(
			api.createMoodLog({ emoji: '🙂', tags: ['运动'], note: '散步' })
		).resolves.toMatchObject({
			createdAt: '2026-10-13T02:00:00Z'
		});
		await expect(api.listApplications()).resolves.toMatchObject([
			{ company: '轻心实验室', interviewDate: '2026-10-20' }
		]);
		await expect(api.listLocalServices({ q: '宠物医院' })).resolves.toMatchObject([
			{ name: '轻心宠物医院', ratingAvg: 4.8, heroKey: 'pet', distanceM: 120 }
		]);
		await expect(api.listCreations()).resolves.toMatchObject([
			{ generatedContent: '示意', finalContent: '示意终稿', promptParams: { topic: '阳台种菜' } }
		]);
	});

	it('parses toolbox SSE deltas and the result event', async () => {
		const sse = [
			'data: {"choices":[{"delta":{"content":"待办："}}]}\n\n',
			'data: {"choices":[{"delta":{"content":"喝水"}}]}\n\n',
			'event: result\ndata: {"id":"task-1","tool_id":"summary","input_kind":"text","input_text":"记得喝水","input_meta":{},"output_text":"待办：喝水","output_json":{"todos":["喝水"]},"source":"mock","disclaimer":"以上为示意结果，不构成专业建议。","created_at":"2026-10-13T03:00:00Z"}\n\n',
			'data: [DONE]\n\n'
		].join('');
		const api = new HttpQingxinApi({
			baseUrl: 'http://127.0.0.1:8080',
			storage: memoryStorage({
				'qingxin.session': JSON.stringify({
					userId: 'user-1',
					displayName: 'Ada',
					email: 'ada@qingxin.app',
					token: 'access-1',
					refreshToken: 'refresh-1'
				})
			}),
			fetch: async (input, init) => {
				expect(String(input)).toBe('http://127.0.0.1:8080/v1/tools/summary/run');
				expect(init?.method).toBe('POST');
				return sseResponse(sse);
			}
		});
		const events = [];
		for await (const event of api.runTool({ toolId: 'summary', text: '记得喝水' })) {
			events.push(event);
		}
		expect(events).toEqual([
			{ type: 'delta', text: '待办：' },
			{ type: 'delta', text: '喝水' },
			{
				type: 'result',
				task: {
					id: 'task-1',
					toolId: 'summary',
					inputKind: 'text',
					inputText: '记得喝水',
					inputMeta: {},
					outputText: '待办：喝水',
					outputJson: { todos: ['喝水'] },
					source: 'mock',
					disclaimer: '以上为示意结果，不构成专业建议。',
					createdAt: '2026-10-13T03:00:00Z'
				}
			}
		]);
	});

	it('maps export payload and treats network failure as unavailable', async () => {
		const ok = new HttpQingxinApi({
			baseUrl: 'http://127.0.0.1:8080',
			storage: memoryStorage({
				'qingxin.session': JSON.stringify({
					userId: 'user-1',
					displayName: 'Ada',
					email: 'ada@qingxin.app',
					token: 'access-1',
					refreshToken: 'refresh-1'
				})
			}),
			fetch: async (input) => {
				if (String(input).endsWith('/v1/privacy/export')) {
					return jsonResponse(200, {
						exported_at: '2026-10-13T04:00:00Z',
						user: { id: 'user-1', email: 'ada@qingxin.app', display_name: 'Ada' },
						mood_logs: [],
						applications: [],
						local_reviews: [],
						creations: [],
						ai_tasks: []
					});
				}
				return jsonResponse(404, { error: { code: 'not_found', message: 'no' } });
			}
		});
		const exported = await ok.exportUserData();
		expect(exported.exportedAt).toBe('2026-10-13T04:00:00Z');
		expect(exported.data.email).toBe('ada@qingxin.app');
		expect(exported.data.displayName).toBe('Ada');

		const down = new HttpQingxinApi({
			baseUrl: 'http://127.0.0.1:8080',
			storage: memoryStorage(),
			fetch: async () => {
				throw new TypeError('Failed to fetch');
			}
		});
		await expect(down.login('a@b.c', 'password1')).rejects.toMatchObject({ code: 'unavailable' });
	});

	it('logs out with the refresh token and deleteAccount accepts 204', async () => {
		const calls: { url: string; method: string; body: string | null }[] = [];
		const storage = memoryStorage({
			'qingxin.session': JSON.stringify({
				userId: 'user-1',
				displayName: 'Ada',
				email: 'ada@qingxin.app',
				token: 'access-1',
				refreshToken: 'refresh-1'
			})
		});
		const api = new HttpQingxinApi({
			baseUrl: 'http://127.0.0.1:8080',
			storage,
			fetch: async (input, init) => {
				calls.push({
					url: String(input),
					method: init?.method ?? 'GET',
					body: init?.body ? String(init.body) : null
				});
				if (String(input).endsWith('/v1/auth/logout')) return emptyResponse(204);
				if (String(input).endsWith('/v1/privacy/account')) return emptyResponse(204);
				return jsonResponse(404, { error: { code: 'not_found', message: 'no' } });
			}
		});
		await api.logout();
		expect(calls[0]).toMatchObject({
			url: 'http://127.0.0.1:8080/v1/auth/logout',
			method: 'POST',
			body: JSON.stringify({ refresh_token: 'refresh-1' })
		});
		await expect(api.getSession()).resolves.toBeNull();

		storage.setItem(
			'qingxin.session',
			JSON.stringify({
				userId: 'user-1',
				displayName: 'Ada',
				email: 'ada@qingxin.app',
				token: 'access-1',
				refreshToken: 'refresh-1'
			})
		);
		const deleter = new HttpQingxinApi({
			baseUrl: 'http://127.0.0.1:8080',
			storage,
			fetch: async (input, init) => {
				expect(String(input)).toBe('http://127.0.0.1:8080/v1/privacy/account');
				expect(init?.method).toBe('DELETE');
				return emptyResponse(204);
			}
		});
		await deleter.deleteAccount();
		await expect(deleter.getSession()).resolves.toBeNull();
	});

	it('sends Bearer and text/event-stream Accept on toolbox run', async () => {
		const api = new HttpQingxinApi({
			baseUrl: 'http://127.0.0.1:8080',
			storage: memoryStorage({
				'qingxin.session': JSON.stringify({
					userId: 'user-1',
					displayName: 'Ada',
					email: 'ada@qingxin.app',
					token: 'access-1',
					refreshToken: 'refresh-1'
				})
			}),
			fetch: async (input, init) => {
				expect(String(input)).toBe('http://127.0.0.1:8080/v1/tools/summary/run');
				expect(String(input)).not.toContain('access-1');
				const headers = new Headers(init?.headers);
				expect(headers.get('Authorization')).toBe('Bearer access-1');
				expect(headers.get('Accept')).toBe('text/event-stream');
				const body = JSON.parse(String(init?.body));
				expect(body).not.toHaveProperty('signal');
				expect(body).toMatchObject({ text: '记得喝水' });
				return sseResponse(
					'data: {"choices":[{"delta":{"content":"待办"}}]}\n\nevent: result\ndata: {"id":"task-1","tool_id":"summary","input_kind":"text","input_text":"记得喝水","output_text":"待办","source":"mock","created_at":"2026-10-13T03:00:00Z"}\n\ndata: [DONE]\n\n'
				);
			}
		});
		const events = [];
		for await (const event of api.runTool({ toolId: 'summary', text: '记得喝水' })) {
			events.push(event.type);
		}
		expect(events).toEqual(['delta', 'result']);
	});

	it('stops the toolbox stream when the abort signal fires', async () => {
		const controller = new AbortController();
		const encoder = new TextEncoder();
		const api = new HttpQingxinApi({
			baseUrl: 'http://127.0.0.1:8080',
			storage: memoryStorage({
				'qingxin.session': JSON.stringify({
					userId: 'user-1',
					displayName: 'Ada',
					email: 'ada@qingxin.app',
					token: 'access-1',
					refreshToken: 'refresh-1'
				})
			}),
			fetch: async (_input, init) => {
				expect(init?.signal).toBe(controller.signal);
				return new Response(
					new ReadableStream({
						async start(stream) {
							stream.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"一"}}]}\n\n'));
							await new Promise<void>((resolve) => {
								const signal = init?.signal;
								if (!signal || signal.aborted) {
									resolve();
									return;
								}
								signal.addEventListener('abort', () => resolve(), { once: true });
							});
							try {
								stream.close();
							} catch {
								/* already cancelled */
							}
						}
					}),
					{ status: 200, headers: { 'Content-Type': 'text/event-stream' } }
				);
			}
		});
		const events: string[] = [];
		const iterating = (async () => {
			for await (const event of api.runTool({
				toolId: 'summary',
				text: '记得喝水',
				signal: controller.signal
			})) {
				events.push(event.type === 'delta' ? event.text : event.type);
				if (event.type === 'delta') controller.abort();
			}
		})();
		await expect(iterating).resolves.toBeUndefined();
		expect(events).toEqual(['一']);
	});

	it('throws unavailable when the SSE body is missing', async () => {
		const api = new HttpQingxinApi({
			baseUrl: 'http://127.0.0.1:8080',
			storage: memoryStorage({
				'qingxin.session': JSON.stringify({
					userId: 'user-1',
					displayName: 'Ada',
					email: 'ada@qingxin.app',
					token: 'access-1',
					refreshToken: 'refresh-1'
				})
			}),
			fetch: async () =>
				new Response(null, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
		});
		await expect(async () => {
			for await (const event of api.runTool({ toolId: 'summary', text: '记得喝水' })) {
				void event;
			}
		}).rejects.toMatchObject({ code: 'unavailable' });
	});

	it('turns event: error frames into ApiError', async () => {
		const api = new HttpQingxinApi({
			baseUrl: 'http://127.0.0.1:8080',
			storage: memoryStorage({
				'qingxin.session': JSON.stringify({
					userId: 'user-1',
					displayName: 'Ada',
					email: 'ada@qingxin.app',
					token: 'access-1',
					refreshToken: 'refresh-1'
				})
			}),
			fetch: async () =>
				sseResponse(
					'data: {"choices":[{"delta":{"content":"待办"}}]}\n\nevent: error\ndata: {"error":{"code":"unavailable","message":"保存失败"}}\n\ndata: [DONE]\n\n'
				)
		});
		await expect(async () => {
			for await (const event of api.runTool({ toolId: 'summary', text: '记得喝水' })) {
				void event;
			}
		}).rejects.toMatchObject({ code: 'unavailable', message: '保存失败' });
	});

	it('maps export templates onto aiTemplates', async () => {
		const api = new HttpQingxinApi({
			baseUrl: 'http://127.0.0.1:8080',
			storage: memoryStorage({
				'qingxin.session': JSON.stringify({
					userId: 'user-1',
					displayName: 'Ada',
					email: 'ada@qingxin.app',
					token: 'access-1',
					refreshToken: 'refresh-1'
				})
			}),
			fetch: async (input) => {
				if (String(input).endsWith('/v1/privacy/export')) {
					return jsonResponse(200, {
						exported_at: '2026-10-13T04:00:00Z',
						user: { id: 'user-1', email: 'ada@qingxin.app', display_name: 'Ada' },
						ai_tasks: [
							{
								id: 'task-1',
								tool_id: 'summary',
								input_kind: 'text',
								input_text: 'x',
								output_text: 'y',
								source: 'mock',
								created_at: '2026-10-13T03:00:00Z'
							}
						],
						templates: [
							{
								id: 'tpl-1',
								tool_id: 'meeting',
								title: '会议助手',
								body: '',
								favourite: true,
								created_at: '2026-10-13T03:00:00Z',
								updated_at: '2026-10-13T03:00:00Z'
							}
						]
					});
				}
				return jsonResponse(404, { error: { code: 'not_found', message: 'no' } });
			}
		});
		const exported = await api.exportUserData();
		expect(exported.data.aiTasks?.some((item) => item.id === 'task-1')).toBe(true);
		expect(exported.data.aiTemplates).toEqual([
			{
				id: 'tpl-1',
				toolId: 'meeting',
				title: '会议助手',
				body: '',
				favourite: true,
				createdAt: '2026-10-13T03:00:00Z',
				updatedAt: '2026-10-13T03:00:00Z'
			}
		]);
	});

	it('posts pets with avatar_url and study challenges with target_days', async () => {
		const calls: { url: string; method?: string; body?: unknown }[] = [];
		const api = new HttpQingxinApi({
			baseUrl: 'http://127.0.0.1:8080',
			storage: memoryStorage({
				'qingxin.session': JSON.stringify({
					userId: 'user-1',
					displayName: 'Ada',
					email: 'ada@qingxin.app',
					token: 'access-1',
					refreshToken: 'refresh-1'
				})
			}),
			fetch: async (input, init) => {
				const url = String(input);
				const body = init?.body ? JSON.parse(String(init.body)) : undefined;
				calls.push({ url, method: init?.method, body });
				if (url.endsWith('/v1/pets') && init?.method === 'POST') {
					return jsonResponse(201, {
						id: 'pet-1',
						name: '豆豆',
						species: 'cat',
						breed: null,
						birthday: null,
						avatar_url: 'https://cdn.example/doudou.png',
						sort_order: 1,
						created_at: '2026-10-13T00:00:00Z',
						updated_at: '2026-10-13T00:00:00Z'
					});
				}
				if (url.endsWith('/v1/study/challenges') && init?.method === 'POST') {
					return jsonResponse(201, {
						id: 'ch-1',
						name: '背单词',
						target_days: 21,
						start_date: '2026-10-13',
						timezone: 'Asia/Shanghai',
						current_streak: 0,
						progress_days: 0,
						checked_in_today: false,
						checkins: [],
						created_at: '2026-10-13T00:00:00Z'
					});
				}
				return jsonResponse(404, { error: { code: 'not_found', message: url } });
			}
		});
		await expect(
			api.createPet({ name: '豆豆', species: 'cat', avatarUrl: 'https://cdn.example/doudou.png' })
		).resolves.toMatchObject({
			id: 'pet-1',
			avatarUrl: 'https://cdn.example/doudou.png'
		});
		await expect(
			api.createStudyChallenge({ name: '背单词', targetDays: 21 })
		).resolves.toMatchObject({
			targetDays: 21,
			currentStreak: 0
		});
		expect(calls[0]).toMatchObject({
			url: 'http://127.0.0.1:8080/v1/pets',
			method: 'POST',
			body: { name: '豆豆', species: 'cat', avatar_url: 'https://cdn.example/doudou.png' }
		});
		expect(calls[0]?.body).not.toHaveProperty('avatarUrl');
		expect(calls[1]).toMatchObject({
			url: 'http://127.0.0.1:8080/v1/study/challenges',
			method: 'POST',
			body: { name: '背单词', target_days: 21 }
		});
	});
});

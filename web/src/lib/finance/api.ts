import type {
	FinanceCategory,
	FinanceChallenge,
	FinanceSubscription,
	FinanceSummary,
	FinanceTransaction
} from './types';

export interface FinanceHttp {
	listCategories(): Promise<FinanceCategory[]>;
	createTransaction(body: {
		amount_fen: number;
		type: 'income' | 'expense';
		category_id: string;
		note?: string;
		occurred_on: string;
		client_id: string;
	}): Promise<FinanceTransaction>;
	summary(month: string): Promise<FinanceSummary>;
}

export function createFinanceHttp(
	baseUrl: string,
	getToken: () => string | null,
	fetchFn: typeof fetch = fetch
): FinanceHttp {
	async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
		const token = getToken();
		const headers = new Headers(init.headers);
		headers.set('Accept', 'application/json');
		if (init.body) headers.set('Content-Type', 'application/json');
		if (token) headers.set('Authorization', `Bearer ${token}`);
		const response = await fetchFn(`${baseUrl}${path}`, { ...init, headers });
		if (!response.ok) {
			throw new Error(`finance ${response.status}`);
		}
		return (await response.json()) as T;
	}
	return {
		async listCategories() {
			const body = await request<{
				items: Array<{ id: string; name: string; kind: 'income' | 'expense'; system: boolean }>;
			}>('/v1/finance/categories');
			return body.items.map((item) => ({
				id: item.id,
				name: item.name,
				kind: item.kind,
				system: item.system
			}));
		},
		async createTransaction(body) {
			const row = await request<{
				id: string;
				amount_fen: number;
				type: 'income' | 'expense';
				category_id: string;
				category_name: string;
				note: string | null;
				occurred_on: string;
				client_id: string;
				created_at: string;
				updated_at: string;
			}>('/v1/finance/transactions', {
				method: 'POST',
				body: JSON.stringify(body)
			});
			return {
				id: row.id,
				amountFen: row.amount_fen,
				currency: 'CNY',
				type: row.type,
				categoryId: row.category_id,
				categoryName: row.category_name,
				note: row.note,
				occurredOn: row.occurred_on,
				clientId: row.client_id,
				createdAt: row.created_at,
				updatedAt: row.updated_at
			};
		},
		async summary(month) {
			return request<FinanceSummary>(`/v1/finance/summary?month=${month}`);
		}
	};
}

export type { FinanceChallenge, FinanceSubscription };

import { writable } from 'svelte/store';

export interface ToastMessage {
	id: string;
	title: string;
	body?: string;
	tone?: 'info' | 'success' | 'danger';
}

const store = writable<ToastMessage[]>([]);

export const toasts = { subscribe: store.subscribe };

export function pushToast(message: Omit<ToastMessage, 'id'> & { id?: string }) {
	const toast: ToastMessage = {
		id: message.id ?? crypto.randomUUID(),
		title: message.title,
		body: message.body,
		tone: message.tone ?? 'info'
	};
	store.update((items) => [...items, toast]);
	window.setTimeout(() => dismissToast(toast.id), 4200);
	return toast.id;
}

export function dismissToast(id: string) {
	store.update((items) => items.filter((item) => item.id !== id));
}

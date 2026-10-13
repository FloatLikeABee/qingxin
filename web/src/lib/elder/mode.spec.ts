import { describe, expect, it } from 'vitest';
import { applyElderMode, ELDER_MODE_KEY, readElderMode, persistElderMode } from './mode';

class MemoryStorage {
	#data = new Map<string, string>();
	getItem(key: string) {
		return this.#data.get(key) ?? null;
	}
	setItem(key: string, value: string) {
		this.#data.set(key, value);
	}
}

describe('elder mode', () => {
	it('is off by default', () => {
		expect(readElderMode(new MemoryStorage())).toBe(false);
	});

	it('persists the global 适老 flag', () => {
		const storage = new MemoryStorage();
		persistElderMode(true, storage);
		expect(storage.getItem(ELDER_MODE_KEY)).toBe('1');
		expect(readElderMode(storage)).toBe(true);
	});

	it('toggles the elder class without forcing light', () => {
		const classes = new Set<string>(['dark']);
		const root = {
			classList: {
				toggle(name: string, force?: boolean) {
					if (force) classes.add(name);
					else classes.delete(name);
				},
				contains(name: string) {
					return classes.has(name);
				}
			}
		};
		applyElderMode(true, root);
		expect(classes.has('elder')).toBe(true);
		expect(classes.has('dark')).toBe(true);
		applyElderMode(false, root);
		expect(classes.has('elder')).toBe(false);
		expect(classes.has('dark')).toBe(true);
	});
});

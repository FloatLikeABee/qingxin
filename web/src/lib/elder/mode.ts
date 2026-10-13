export const ELDER_MODE_KEY = 'qingxin.elderMode';

export function readElderMode(
	storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage
): boolean {
	try {
		return storage?.getItem(ELDER_MODE_KEY) === '1';
	} catch {
		return false;
	}
}

export function persistElderMode(
	on: boolean,
	storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage
) {
	try {
		storage?.setItem(ELDER_MODE_KEY, on ? '1' : '0');
	} catch {
		// Ignore quota / private-mode failures.
	}
}

export function applyElderMode(
	on: boolean,
	root: { classList: { toggle: (name: string, force?: boolean) => unknown } }
) {
	root.classList.toggle('elder', on);
}

export function syncElderMode(
	on: boolean = typeof document === 'undefined' ? false : readElderMode(),
	root?: { classList: { toggle: (name: string, force?: boolean) => unknown } }
) {
	if (typeof document === 'undefined' && !root) return;
	applyElderMode(on, root ?? document.documentElement);
}

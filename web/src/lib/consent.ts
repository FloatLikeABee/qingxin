export const CONSENT_KEY = 'qingxin.privacyConsent';

export type ConsentState = 'unknown' | 'accepted' | 'rejected';

export function readConsent(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): ConsentState {
	try {
		const value = storage?.getItem(CONSENT_KEY);
		if (value === 'accepted' || value === 'rejected') return value;
	} catch {
		return 'unknown';
	}
	return 'unknown';
}

export function persistConsent(
	state: Exclude<ConsentState, 'unknown'>,
	storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage
) {
	try {
		storage?.setItem(CONSENT_KEY, state);
	} catch {
		// Private mode: keep the in-memory decision for this session only.
	}
}

export type EnvelopeRole = 'secret' | 'reply';

export interface BoardLetter {
	id: string;
	role: EnvelopeRole;
	title: string;
	body: string;
	createdAt: string;
	consentedAt?: string;
}

export interface SecretThread {
	id: string;
	secret: BoardLetter;
	reply: BoardLetter;
}

export interface Envelope extends BoardLetter {
	kind: 'envelope';
	layout: 'board';
	from: 'me' | 'mailbox';
	pairId: string;
}

export function envelopesOnBoard(threads: SecretThread[]): Envelope[] {
	const board: Envelope[] = [];
	for (const thread of threads) {
		board.push({
			...thread.secret,
			kind: 'envelope',
			layout: 'board',
			from: 'me',
			pairId: thread.id
		});
		board.push({
			...thread.reply,
			kind: 'envelope',
			layout: 'board',
			from: 'mailbox',
			pairId: thread.id
		});
	}
	return board;
}

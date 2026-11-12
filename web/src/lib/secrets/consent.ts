export const SECRET_CONSENT_COPY =
	'我同意把这封信用来生成一封私人回信。信只保存在我的账户里，不会公开张贴。';

export type SecretSendResult = { ok: true; body: string } | { ok: false; reason: string };

export function assertCanSendSecret(input: { body: string; consented: boolean }): SecretSendResult {
	if (!input.consented) {
		return { ok: false, reason: '请先同意把信用来写回信，且不会公开发布。' };
	}
	const body = input.body.trim();
	if (!body) {
		return { ok: false, reason: '请先写信，再投进信箱。' };
	}
	return { ok: true, body };
}

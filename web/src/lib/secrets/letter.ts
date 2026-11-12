export const SECRET_DISCLAIMER = '秘密信箱不是心理咨询或危机干预。如需即时帮助，请拨打 12356。';

export function composeMailboxReply(_secretBody: string): string {
	return [
		'亲爱的来信人：',
		'',
		'信已收到。我会把这些字留在只有你能打开的格子里。',
		'',
		'你愿意把心里的话交给纸面，这件事本身已经很轻、也很勇敢。',
		'',
		'此致',
		'轻心信箱'
	].join('\n');
}

export const CONTROL_MIN_PX = 44;
export const BUTTON_PADDING_INLINE_PX = 24;
export const FIELD_GAP_PX = 16;

export const LINK_CLASS =
	'qx-link inline-flex min-h-11 items-center gap-1 text-base text-[var(--qx-primary)] underline decoration-[var(--qx-primary)] underline-offset-4';

export function passwordInputType(revealed: boolean): 'password' | 'text' {
	return revealed ? 'text' : 'password';
}

export function passwordToggleLabel(revealed: boolean): string {
	return revealed ? '隐藏密码' : '显示密码';
}

import { describe, expect, it } from 'vitest';
import {
	BUTTON_PADDING_INLINE_PX,
	CONTROL_MIN_PX,
	LINK_CLASS,
	passwordInputType,
	passwordToggleLabel
} from './affordance';

describe('affordance', () => {
	it('keeps password type until revealed', () => {
		expect(passwordInputType(false)).toBe('password');
		expect(passwordInputType(true)).toBe('text');
	});

	it('labels the toggle in zh-CN', () => {
		expect(passwordToggleLabel(false)).toBe('显示密码');
		expect(passwordToggleLabel(true)).toBe('隐藏密码');
	});

	it('makes links look clickable', () => {
		expect(LINK_CLASS).toContain('underline');
		expect(LINK_CLASS).toContain('text-[var(--qx-primary)]');
	});

	it('uses 44px targets and generous button padding', () => {
		expect(CONTROL_MIN_PX).toBe(44);
		expect(BUTTON_PADDING_INLINE_PX).toBeGreaterThanOrEqual(24);
	});
});

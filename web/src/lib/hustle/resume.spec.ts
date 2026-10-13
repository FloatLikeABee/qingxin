import { describe, expect, it } from 'vitest';
import {
	A4_COLORS,
	resumePreviewClass,
	resumeToPrintableHtml,
	validateResumeContent
} from './resume';

describe('resume helpers', () => {
	it('requires a name', () => {
		const missing = validateResumeContent({ title: '前端' });
		expect(missing.ok).toBe(false);
		if (!missing.ok) expect(missing.code).toBe('invalid_request');
		const ok = validateResumeContent({ name: '林轻心', title: '前端工程师' });
		expect(ok.ok).toBe(true);
	});

	it('keeps A4 preview on a hardcoded light palette', () => {
		expect(resumePreviewClass).toBe('resume-a4');
		expect(A4_COLORS.background).toBe('#FFFFFF');
		expect(A4_COLORS.text).toBe('#1F2937');
	});

	it('builds printable HTML that stays light and includes the name', () => {
		const html = resumeToPrintableHtml({
			name: '林轻心',
			title: '前端工程师',
			summary: '把界面做安静一点。'
		});
		expect(html).toContain('林轻心');
		expect(html).toContain('#FFFFFF');
		expect(html).toContain('#1F2937');
	});
});

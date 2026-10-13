import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	A4_COLORS,
	resumePreviewClass,
	resumeToPrintableHtml,
	validateResumeContent
} from './resume';

const layoutCss = readFileSync(
	join(dirname(fileURLToPath(import.meta.url)), '../../routes/layout.css'),
	'utf8'
);

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

	it('scales the A4 sheet to the shell width instead of a cramped fixed factor', () => {
		expect(layoutCss).toMatch(/\.resume-a4-shell[\s\S]*container-type:\s*inline-size/);
		expect(layoutCss).toMatch(/\.resume-a4-shell[\s\S]*aspect-ratio:\s*210\s*\/\s*297/);
		expect(layoutCss).toContain('100cqi');
		expect(layoutCss).toMatch(/\.resume-a4[\s\S]*color-scheme:\s*light/);
		expect(layoutCss).not.toContain('297mm * 0.46');
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

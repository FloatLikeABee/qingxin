export const resumePreviewClass = 'resume-a4';

export const A4_COLORS = {
	background: '#FFFFFF',
	text: '#1F2937',
	muted: '#6B7280',
	line: '#E5E7EB'
} as const;

export interface ResumeContent {
	name?: string;
	title?: string;
	email?: string;
	phone?: string;
	summary?: string;
	education?: { school: string; degree: string; years: string }[];
	experience?: { company: string; role: string; years: string; bullets: string }[];
	skills?: string[];
}

export type ResumeForm = Required<
	Pick<
		ResumeContent,
		'name' | 'title' | 'email' | 'phone' | 'summary' | 'education' | 'experience' | 'skills'
	>
>;

export type ResumeValidation =
	| { ok: true; value: ResumeContent & { name: string } }
	| { ok: false; code: 'invalid_request'; message: string };

export function validateResumeContent(content: ResumeContent): ResumeValidation {
	const name = content.name?.trim() ?? '';
	if (!name) {
		return { ok: false, code: 'invalid_request', message: '请填写姓名' };
	}
	return {
		ok: true,
		value: {
			...content,
			name,
			title: content.title?.trim() ?? '',
			email: content.email?.trim() ?? '',
			phone: content.phone?.trim() ?? '',
			summary: content.summary?.trim() ?? '',
			education: content.education ?? [],
			experience: content.experience ?? [],
			skills: content.skills ?? []
		}
	};
}

export function resumeToPrintableHtml(content: ResumeContent): string {
	const name = content.name?.trim() || '未命名';
	const title = content.title?.trim() ?? '';
	const summary = content.summary?.trim() ?? '';
	const skills = (content.skills ?? []).join(' · ');
	const education = (content.education ?? [])
		.map(
			(item) =>
				`<p>${escapeHtml(item.school)} · ${escapeHtml(item.degree)} · ${escapeHtml(item.years)}</p>`
		)
		.join('');
	const experience = (content.experience ?? [])
		.map(
			(item) =>
				`<p><strong>${escapeHtml(item.company)}</strong> ${escapeHtml(item.role)} ${escapeHtml(item.years)}</p><p>${escapeHtml(item.bullets)}</p>`
		)
		.join('');
	return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(name)}</title>
<style>
  body { background: ${A4_COLORS.background}; color: ${A4_COLORS.text}; font-family: "Noto Sans SC", sans-serif; }
  .resume-a4 { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 18mm; background: ${A4_COLORS.background}; color: ${A4_COLORS.text}; }
  h1 { margin: 0; font-size: 28px; } p { color: ${A4_COLORS.text}; }
  .muted { color: ${A4_COLORS.muted}; }
</style></head><body><article class="resume-a4">
  <h1>${escapeHtml(name)}</h1>
  <p class="muted">${escapeHtml(title)}</p>
  <p>${escapeHtml(summary)}</p>
  ${skills ? `<p>${escapeHtml(skills)}</p>` : ''}
  ${education}${experience}
</article></body></html>`;
}

export function printResume(content: ResumeContent): void {
	const html = resumeToPrintableHtml(content);
	const frame = document.createElement('iframe');
	frame.setAttribute('aria-hidden', 'true');
	frame.style.position = 'fixed';
	frame.style.right = '0';
	frame.style.bottom = '0';
	frame.style.width = '0';
	frame.style.height = '0';
	frame.style.border = '0';
	document.body.appendChild(frame);
	const win = frame.contentWindow;
	if (!win) {
		frame.remove();
		return;
	}
	win.document.open();
	win.document.write(html);
	win.document.close();
	win.focus();
	win.print();
	window.setTimeout(() => frame.remove(), 800);
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

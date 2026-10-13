import type { InterviewQuestion, SideHustle, HustleKind } from './catalog';

export function filterQuestions(
	items: InterviewQuestion[],
	filter: { role?: string; difficulty?: string } = {}
): InterviewQuestion[] {
	return items.filter((item) => {
		if (filter.role && item.role !== filter.role) return false;
		if (filter.difficulty && item.difficulty !== filter.difficulty) return false;
		return true;
	});
}

export function filterSideHustles(items: SideHustle[], kind?: HustleKind | ''): SideHustle[] {
	if (!kind) return [...items];
	return items.filter((item) => item.kind === kind);
}

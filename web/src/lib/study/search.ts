export function matchesNote(
	note: { title: string; tags: string[]; contentMd?: string },
	query: string
): boolean {
	const needle = query.trim().toLowerCase();
	if (!needle) return true;
	if (note.title.toLowerCase().includes(needle)) return true;
	return note.tags.some((tag) => tag.toLowerCase().includes(needle));
}

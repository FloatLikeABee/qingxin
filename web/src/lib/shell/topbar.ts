export function topbarOffsetPx(playView: boolean, headerBottom: number | null | undefined): string {
	if (playView || headerBottom == null || !Number.isFinite(headerBottom)) {
		return '0px';
	}
	return `${Math.max(0, Math.ceil(headerBottom))}px`;
}

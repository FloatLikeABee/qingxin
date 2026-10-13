export function pieSlicePath(start: number, sweep: number, cx = 50, cy = 50, r = 40): string {
	if (sweep <= 0) return '';
	if (sweep >= Math.PI * 2 - 1e-6) {
		return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
	}
	const x1 = cx + r * Math.cos(start);
	const y1 = cy + r * Math.sin(start);
	const end = start + sweep;
	const x2 = cx + r * Math.cos(end);
	const y2 = cy + r * Math.sin(end);
	const large = sweep > Math.PI ? 1 : 0;
	return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

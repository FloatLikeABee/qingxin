import { COMMUNITY_ORIGIN, type ElderTag, type LocalCategory, type LocalService } from './catalog';

export type LocalSort = 'distance' | 'rating';

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const r = 6_371_000;
	const p1 = (lat1 * Math.PI) / 180;
	const p2 = (lat2 * Math.PI) / 180;
	const dp = ((lat2 - lat1) * Math.PI) / 180;
	const dl = ((lng2 - lng1) * Math.PI) / 180;
	const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
	return 2 * r * Math.asin(Math.sqrt(a));
}

export function withDistance(
	items: LocalService[],
	origin: { lat: number; lng: number } = COMMUNITY_ORIGIN
): LocalService[] {
	return items.map((item) => ({
		...item,
		distanceM: Math.round(haversineM(origin.lat, origin.lng, item.latitude, item.longitude))
	}));
}

export function searchServices(
	items: LocalService[],
	filter: { q?: string; category?: LocalCategory | ''; tag?: ElderTag | '' } = {}
): LocalService[] {
	const q = filter.q?.trim().toLowerCase();
	return items.filter((item) => {
		if (q && !item.name.toLowerCase().includes(q) && !item.address.toLowerCase().includes(q))
			return false;
		if (filter.category && item.category !== filter.category) return false;
		if (filter.tag && !item.tags.includes(filter.tag)) return false;
		return true;
	});
}

export function sortServices(
	items: LocalService[],
	sort: LocalSort = 'distance',
	origin: { lat: number; lng: number } = COMMUNITY_ORIGIN
): LocalService[] {
	const copy = withDistance(items, origin);
	if (sort === 'rating') {
		copy.sort((a, b) => b.ratingAvg - a.ratingAvg);
	} else {
		copy.sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
	}
	return copy;
}

export function formatDistance(meters?: number): string {
	if (meters == null) return '';
	if (meters < 1000) return `${Math.round(meters)} 米`;
	return `${(meters / 1000).toFixed(1)} 公里`;
}

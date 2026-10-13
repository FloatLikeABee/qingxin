import { COMMUNITY_ORIGIN, type LocalService } from './catalog';

export type MapProviderId = 'stub' | 'osm';
export type MapTheme = 'light' | 'dark';

export interface MapProviderEnv {
	online: boolean;
	preference?: string | null;
	webdriver: boolean;
}

export function selectMapProvider(env: MapProviderEnv): MapProviderId {
	if (env.webdriver || !env.online) return 'stub';
	if (env.preference === 'osm') return 'osm';
	return 'stub';
}

export function currentMapEnv(): MapProviderEnv {
	const online = typeof navigator === 'undefined' ? false : navigator.onLine;
	const webdriver = typeof navigator !== 'undefined' && Boolean(navigator.webdriver);
	let preference: string | null = null;
	try {
		preference = globalThis.localStorage?.getItem('qingxin.mapProvider') ?? null;
	} catch {
		preference = null;
	}
	return { online, preference, webdriver };
}

function bounds(services: LocalService[]) {
	const lats = services.map((item) => item.latitude);
	const lngs = services.map((item) => item.longitude);
	lats.push(COMMUNITY_ORIGIN.lat);
	lngs.push(COMMUNITY_ORIGIN.lng);
	const pad = 0.0018;
	return {
		minLat: Math.min(...lats) - pad,
		maxLat: Math.max(...lats) + pad,
		minLng: Math.min(...lngs) - pad,
		maxLng: Math.max(...lngs) + pad
	};
}

export function projectMarker(
	service: Pick<LocalService, 'latitude' | 'longitude'>,
	services: LocalService[],
	width: number,
	height: number
): { x: number; y: number } {
	const box = bounds(services);
	const xRatio = (service.longitude - box.minLng) / (box.maxLng - box.minLng || 1);
	const yRatio = (box.maxLat - service.latitude) / (box.maxLat - box.minLat || 1);
	const inset = 16;
	return {
		x: inset + xRatio * (width - inset * 2),
		y: inset + yRatio * (height - inset * 2)
	};
}

export function stubBackground(theme: MapTheme): string {
	return theme === 'dark' ? '#0b1220' : '#e8f0e3';
}

export function markerFill(theme: MapTheme, selected: boolean): string {
	if (selected) return theme === 'dark' ? '#93c5fd' : '#2563eb';
	return theme === 'dark' ? '#60a5fa' : '#3b82f6';
}

export function osmTileUrl(theme: MapTheme): string {
	if (theme === 'dark') {
		return 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
	}
	return 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';
}

export function long2tile(lng: number, zoom: number): number {
	return Math.floor(((lng + 180) / 360) * 2 ** zoom);
}

export function lat2tile(lat: number, zoom: number): number {
	const rad = (lat * Math.PI) / 180;
	return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom);
}

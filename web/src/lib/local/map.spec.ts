import { describe, expect, it } from 'vitest';
import { COMMUNITY_ORIGIN, SEED_SERVICES } from './catalog';
import { markerFill, osmTileUrl, projectMarker, selectMapProvider, stubBackground } from './map';

describe('map provider seam', () => {
	it('selects stub in Playwright and when offline even if osm is preferred', () => {
		expect(selectMapProvider({ online: true, preference: 'osm', webdriver: true })).toBe('stub');
		expect(selectMapProvider({ online: false, preference: 'osm', webdriver: false })).toBe('stub');
		expect(selectMapProvider({ online: true, preference: undefined, webdriver: false })).toBe(
			'stub'
		);
		expect(selectMapProvider({ online: true, preference: 'osm', webdriver: false })).toBe('osm');
	});

	it('projects a point inside the seed bounding box', () => {
		const point = projectMarker(SEED_SERVICES[0]!, SEED_SERVICES, 320, 240);
		expect(point.x).toBeGreaterThan(8);
		expect(point.x).toBeLessThan(312);
		expect(point.y).toBeGreaterThan(8);
		expect(point.y).toBeLessThan(232);
	});

	it('uses a dark background and a brighter selected marker in dark appearance', () => {
		expect(stubBackground('dark')).toMatch(/#0b1220/i);
		expect(stubBackground('light')).not.toMatch(/#0b1220/i);
		const selectedDark = markerFill('dark', true);
		const idleDark = markerFill('dark', false);
		expect(selectedDark).not.toBe(idleDark);
		expect(osmTileUrl('dark')).toContain('dark_all');
		expect(osmTileUrl('light')).toContain('voyager');
	});

	it('keeps the community origin inside the 15-minute ring math', () => {
		const origin = projectMarker(
			{ ...SEED_SERVICES[0]!, latitude: COMMUNITY_ORIGIN.lat, longitude: COMMUNITY_ORIGIN.lng },
			SEED_SERVICES,
			320,
			240
		);
		expect(origin.x).toBeGreaterThan(40);
		expect(origin.x).toBeLessThan(280);
	});
});

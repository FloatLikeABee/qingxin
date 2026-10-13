import { describe, expect, it } from 'vitest';
import { COMMUNITY_ORIGIN, SEED_SERVICES } from './catalog';
import { haversineM, searchServices, sortServices } from './geo';

describe('local geo', () => {
	it('is ~0m at the same point and ~1km one hundredth of a degree east', () => {
		expect(
			haversineM(
				COMMUNITY_ORIGIN.lat,
				COMMUNITY_ORIGIN.lng,
				COMMUNITY_ORIGIN.lat,
				COMMUNITY_ORIGIN.lng
			)
		).toBeLessThan(0.5);
		const east = haversineM(
			COMMUNITY_ORIGIN.lat,
			COMMUNITY_ORIGIN.lng,
			COMMUNITY_ORIGIN.lat,
			COMMUNITY_ORIGIN.lng + 0.01
		);
		expect(east).toBeGreaterThan(900);
		expect(east).toBeLessThan(1100);
	});

	it('finds 宠物医院 by search and keeps only matching names', () => {
		const found = searchServices(SEED_SERVICES, { q: '宠物医院' });
		expect(found.length).toBeGreaterThan(0);
		expect(found.every((item) => item.name.includes('宠物医院'))).toBe(true);
	});

	it('sorts by rating descending and by distance ascending', () => {
		const byRating = sortServices(SEED_SERVICES, 'rating', COMMUNITY_ORIGIN);
		const ratings = byRating.map((item) => item.ratingAvg);
		expect([...ratings].sort((a, b) => b - a)).toEqual(ratings);
		const byDistance = sortServices(SEED_SERVICES, 'distance', COMMUNITY_ORIGIN);
		const distances = byDistance.map((item) =>
			haversineM(COMMUNITY_ORIGIN.lat, COMMUNITY_ORIGIN.lng, item.latitude, item.longitude)
		);
		expect([...distances].sort((a, b) => a - b)).toEqual(distances);
	});

	it('filters elder-friendly ramp tags', () => {
		const ramps = searchServices(SEED_SERVICES, { tag: '有坡道' });
		expect(ramps.length).toBeGreaterThan(0);
		expect(ramps.every((item) => item.tags.includes('有坡道'))).toBe(true);
	});
});

import { describe, expect, it } from 'vitest';
import { validatePublish, validateReview } from './validate';

describe('local validation', () => {
	it('rejects an unknown category and a missing name', () => {
		expect(
			validatePublish({
				name: '夜店',
				category: '酒吧',
				address: '静安区',
				latitude: 31.23,
				longitude: 121.47
			}).ok
		).toBe(false);
		expect(
			validatePublish({
				name: '',
				category: '维修',
				address: '轻心路',
				latitude: 31.23,
				longitude: 121.47
			}).ok
		).toBe(false);
	});

	it('accepts a repair listing with elder tags', () => {
		const checked = validatePublish({
			name: '街角修伞铺',
			category: '维修',
			address: '轻心路 8 号',
			latitude: 31.2298,
			longitude: 121.4742,
			tags: ['耐心服务']
		});
		expect(checked.ok).toBe(true);
	});

	it('rejects a 501-character review and an empty one', () => {
		expect(validateReview({ content: '字'.repeat(501) }).ok).toBe(false);
		expect(validateReview({ content: '   ' }).ok).toBe(false);
		expect(validateReview({ content: '医生很耐心', rating: 5 }).ok).toBe(true);
	});
});

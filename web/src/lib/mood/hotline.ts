export const HOTLINE_NUMBER = '12356';
export const HOTLINE_NAME = '全国心理援助热线';

export function hotlineHref(): string {
	return `tel:${HOTLINE_NUMBER}`;
}

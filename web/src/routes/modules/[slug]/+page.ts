import { error } from '@sveltejs/kit';
import { getModule, MODULES } from '#lib/modules';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () =>
	MODULES.filter(
		(item) =>
			!['mood', 'hustle', 'finance', 'pet', 'local', 'health', 'create', 'study', 'ai'].includes(
				item.slug
			)
	).map((item) => ({
		slug: item.slug
	}));

export const load: PageLoad = ({ params }) => {
	const module = getModule(params.slug);
	if (!module) error(404, '未找到该模块');
	return { module };
};

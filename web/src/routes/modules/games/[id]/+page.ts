import { error } from '@sveltejs/kit';
import { GAMES, getGame } from '#lib/games/catalog';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => GAMES.map((game) => ({ id: game.id }));

export const load: PageLoad = ({ params }) => {
	const game = getGame(params.id);
	if (!game) error(404, '未找到该游戏');
	return { game };
};

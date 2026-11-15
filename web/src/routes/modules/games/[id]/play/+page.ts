import { error, redirect } from '@sveltejs/kit';
import { aliasTarget, GAME_ALIASES, GAMES, getGame } from '#lib/games/catalog';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => [
	...GAMES.filter((game) => game.status === 'playable').map((game) => ({ id: game.id })),
	...Object.keys(GAME_ALIASES).map((id) => ({ id }))
];

export const load: PageLoad = ({ params }) => {
	const aliased = aliasTarget(params.id);
	if (aliased) redirect(301, `/modules/games/${aliased}/play`);
	const game = getGame(params.id);
	if (!game) error(404, '未找到该游戏');
	if (game.status !== 'playable') redirect(302, `/modules/games/${game.id}`);
	return { game };
};

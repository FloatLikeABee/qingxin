import type { GameInfo } from './catalog';

export function filterGames(
	games: GameInfo[],
	query: { search?: string; category?: string } = {}
): GameInfo[] {
	const needle = (query.search ?? '').trim().toLowerCase();
	const category = query.category && query.category !== '全部' ? query.category : '';
	return games.filter((game) => {
		if (category && game.category !== category) return false;
		if (!needle) return true;
		const hay = [game.title, game.englishTitle ?? '', game.summary, game.category, ...game.tags]
			.join(' ')
			.toLowerCase();
		return hay.includes(needle);
	});
}

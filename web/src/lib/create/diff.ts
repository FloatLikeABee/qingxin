export type DiffHunk = { type: 'equal' | 'add' | 'remove'; text: string };

export function diffLines(previous: string, next: string): DiffHunk[] {
	const a = previous.split('\n');
	const b = next.split('\n');
	const n = a.length;
	const m = b.length;
	const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
		}
	}
	const hunks: DiffHunk[] = [];
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (a[i] === b[j]) {
			hunks.push({ type: 'equal', text: a[i] });
			i += 1;
			j += 1;
		} else if (dp[i + 1][j] >= dp[i][j + 1]) {
			hunks.push({ type: 'remove', text: a[i] });
			i += 1;
		} else {
			hunks.push({ type: 'add', text: b[j] });
			j += 1;
		}
	}
	while (i < n) {
		hunks.push({ type: 'remove', text: a[i] });
		i += 1;
	}
	while (j < m) {
		hunks.push({ type: 'add', text: b[j] });
		j += 1;
	}
	return hunks;
}

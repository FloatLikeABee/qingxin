export async function optimistic<T>(apply: () => void, revert: () => void, task: () => Promise<T>): Promise<T> {
	apply();
	try {
		return await task();
	} catch (error) {
		revert();
		throw error;
	}
}

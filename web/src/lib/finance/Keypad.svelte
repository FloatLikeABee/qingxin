<script lang="ts">
	let { value, onkey }: { value: string; onkey: (key: string) => void } = $props();

	const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];
</script>

<div class="grid grid-cols-3 gap-2" role="group" aria-label="金额键盘">
	{#each keys as key (key)}
		<button
			type="button"
			class="min-h-14 rounded-2xl bg-[var(--qx-surface)] text-xl font-semibold"
			onclick={() => onkey(key)}
		>
			{key === 'back' ? '⌫' : key}
		</button>
	{/each}
</div>
<p class="sr-only">当前金额 {value || '0'}</p>

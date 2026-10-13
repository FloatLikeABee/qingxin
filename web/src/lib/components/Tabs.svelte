<script lang="ts">
	let {
		tabs,
		value = $bindable(0)
	}: {
		tabs: string[];
		value?: number;
	} = $props();
</script>

<div class="grid grid-cols-3 gap-1 rounded-2xl bg-[var(--qx-surface)] p-1" role="tablist">
	{#each tabs as tab, index (tab)}
		<button
			type="button"
			role="tab"
			aria-selected={value === index}
			class="min-h-11 rounded-xl text-base transition {value === index
				? 'bg-[var(--qx-card)] text-[var(--qx-text)] shadow-sm'
				: 'text-[var(--qx-muted)]'}"
			onclick={() => (value = index)}
		>
			{tab}
		</button>
	{/each}
</div>

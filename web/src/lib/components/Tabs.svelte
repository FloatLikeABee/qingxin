<script lang="ts">
	let {
		tabs,
		value = $bindable(0)
	}: {
		tabs: string[];
		value?: number;
	} = $props();
</script>

<div
	class="grid gap-1 rounded-2xl bg-[var(--qx-surface)] p-1"
	role="tablist"
	style="grid-template-columns: repeat({Math.min(Math.max(tabs.length, 1), 5)}, minmax(0, 1fr))"
>
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

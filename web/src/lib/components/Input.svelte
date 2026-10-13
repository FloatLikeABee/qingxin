<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		label,
		hint,
		value = $bindable(''),
		class: className = '',
		id = crypto.randomUUID(),
		...rest
	}: {
		label: string;
		hint?: string;
		value?: string;
		class?: string;
		id?: string;
	} & HTMLInputAttributes = $props();
</script>

<label class="block space-y-2 {className}" for={id}>
	<span class="text-base font-medium text-[var(--qx-text)]">{label}</span>
	<input
		{id}
		bind:value
		class="min-h-11 w-full rounded-2xl border border-[var(--qx-line)] bg-[var(--qx-bg)] px-4 text-base text-[var(--qx-text)] outline-none ring-[var(--qx-primary)] placeholder:text-[var(--qx-muted)] focus:ring-2"
		{...rest}
	/>
	{#if hint}
		<span class="text-sm text-[var(--qx-muted)]">{hint}</span>
	{/if}
</label>

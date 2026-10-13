<script lang="ts">
	let {
		checked = $bindable(false),
		label,
		description
	}: {
		checked?: boolean;
		label: string;
		description?: string;
	} = $props();
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	class="flex min-h-11 w-full items-center justify-between gap-4 text-left"
	onclick={() => (checked = !checked)}
>
	<span>
		<span class="block text-base font-medium">{label}</span>
		{#if description}
			<span class="block text-sm text-[var(--qx-muted)]">{description}</span>
		{/if}
	</span>
	<span
		class="relative h-7 w-12 shrink-0 rounded-full transition {checked
			? 'bg-[var(--qx-primary)]'
			: 'bg-[var(--qx-line)]'}"
	>
		<span
			class="absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition motion-safe:duration-200 {checked
				? 'translate-x-5'
				: ''}"
		></span>
	</span>
</button>

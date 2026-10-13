<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	let {
		label,
		value = $bindable(''),
		class: className = '',
		id = crypto.randomUUID(),
		...rest
	}: {
		label: string;
		value?: string;
		class?: string;
		id?: string;
	} & HTMLTextareaAttributes = $props();
</script>

<label class="block space-y-2 {className}" for={id}>
	<span class="text-base font-medium text-[var(--qx-text)]">{label}</span>
	<textarea
		{id}
		bind:value
		class="min-h-28 w-full rounded-2xl border border-[var(--qx-line)] bg-[var(--qx-bg)] px-4 py-3 text-base text-[var(--qx-text)] outline-none ring-[var(--qx-primary)] placeholder:text-[var(--qx-muted)] focus:ring-2"
		{...rest}
	></textarea>
</label>

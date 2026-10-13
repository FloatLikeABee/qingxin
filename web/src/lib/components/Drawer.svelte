<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		title,
		children
	}: {
		open?: boolean;
		title: string;
		children: Snippet;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});

	function onDialogClick(event: MouseEvent) {
		if (!dialog || event.target !== dialog) return;
		if ('closedBy' in HTMLDialogElement.prototype) return;
		open = false;
	}
</script>

<dialog
	bind:this={dialog}
	class="qx-drawer mt-auto mb-0 w-full max-w-none rounded-t-[28px] border-0 bg-[var(--qx-card)] p-0 text-[var(--qx-text)] shadow-2xl backdrop:bg-slate-950/40"
	closedby="any"
	aria-labelledby="qx-drawer-title"
	onclose={() => (open = false)}
	onclick={onDialogClick}
>
	<div class="px-5 pt-3 pb-8">
		<div class="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[var(--qx-line)]"></div>
		<h2 id="qx-drawer-title" class="mb-4 text-xl font-semibold">{title}</h2>
		{@render children()}
	</div>
</dialog>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';

	let {
		open = $bindable(false),
		title,
		dismissible = true,
		children,
		footer
	}: {
		open?: boolean;
		title: string;
		dismissible?: boolean;
		children: Snippet;
		footer?: Snippet;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});

	$effect(() => {
		if (!dialog || dismissible) return;
		if ('closedBy' in HTMLDialogElement.prototype) {
			(dialog as HTMLDialogElement & { closedBy: string }).closedBy = 'none';
		}
	});

	function onDialogClick(event: MouseEvent) {
		if (!dismissible || !dialog || event.target !== dialog) return;
		if ('closedBy' in HTMLDialogElement.prototype) return;
		const rect = dialog.getBoundingClientRect();
		const inside =
			rect.top <= event.clientY &&
			event.clientY <= rect.bottom &&
			rect.left <= event.clientX &&
			event.clientX <= rect.right;
		if (!inside) open = false;
	}
</script>

<dialog
	bind:this={dialog}
	class="qx-modal w-[min(92vw,440px)] rounded-[28px] border-0 bg-[var(--qx-card)] p-0 text-[var(--qx-text)] shadow-2xl backdrop:bg-slate-950/45 backdrop:backdrop-blur-sm"
	closedby={dismissible ? 'any' : 'none'}
	aria-labelledby="qx-modal-title"
	onclose={() => (open = false)}
	onclick={onDialogClick}
>
	<div class="p-6">
		<div class="mb-4 flex items-start justify-between gap-3">
			<h2 id="qx-modal-title" class="text-xl font-semibold">{title}</h2>
			{#if dismissible}
				<Button variant="ghost" class="min-h-11 w-11 px-0" onclick={() => (open = false)} aria-label="关闭">
					<Icon name="close" />
				</Button>
			{/if}
		</div>
		<div class="space-y-3 text-base text-[var(--qx-muted)]">
			{@render children()}
		</div>
		{#if footer}
			<div class="mt-6 flex flex-col gap-3">
				{@render footer()}
			</div>
		{/if}
	</div>
</dialog>

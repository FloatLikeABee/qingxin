<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { passwordInputType, passwordToggleLabel } from '../ui/affordance';
	import Icon from './Icon.svelte';

	let {
		label,
		hint,
		error,
		value = $bindable(''),
		class: className = '',
		id = crypto.randomUUID(),
		type = 'text',
		...rest
	}: {
		label: string;
		hint?: string;
		error?: string;
		value?: string;
		class?: string;
		id?: string;
		type?: HTMLInputAttributes['type'];
	} & Omit<HTMLInputAttributes, 'type' | 'value' | 'id' | 'class'> = $props();

	let revealed = $state(false);
	const isPassword = $derived(type === 'password');
	const resolvedType = $derived(isPassword ? passwordInputType(revealed) : type);
</script>

<div class="block space-y-2 {className}">
	<label class="text-base font-medium text-[var(--qx-text)]" for={id}>{label}</label>
	<span class="relative block">
		<input
			{id}
			bind:value
			type={resolvedType}
			class="min-h-11 w-full rounded-2xl border bg-[var(--qx-bg)] px-4 text-base text-[var(--qx-text)] outline-none ring-[var(--qx-primary)] placeholder:text-[var(--qx-muted)] focus:ring-2 {isPassword
				? 'pe-14'
				: ''} {error
				? 'border-[var(--qx-danger)]'
				: 'border-[var(--qx-line)]'}"
			{...rest}
		/>
		{#if isPassword}
			<button
				type="button"
				class="absolute top-1/2 right-1 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--qx-muted)] hover:text-[var(--qx-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qx-primary)]"
				aria-label={passwordToggleLabel(revealed)}
				aria-pressed={revealed}
				aria-controls={id}
				onclick={() => (revealed = !revealed)}
			>
				<Icon name={revealed ? 'eyeOff' : 'eye'} />
			</button>
		{/if}
	</span>
	{#if error}
		<span class="text-sm text-[var(--qx-danger)]">{error}</span>
	{:else if hint}
		<span class="text-sm text-[var(--qx-muted)]">{hint}</span>
	{/if}
</div>

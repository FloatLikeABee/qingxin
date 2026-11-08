<script lang="ts">
	let { lines = 3, variant = 'lines' }: { lines?: number; variant?: 'lines' | 'page' } = $props();
</script>

{#if variant === 'page'}
	<div class="space-y-4" aria-busy="true" aria-live="polite">
		<div class="flex items-center gap-3">
			<div class="h-12 w-12 shrink-0 rounded-full bg-[var(--qx-line)] motion-safe:animate-pulse"></div>
			<div class="min-w-0 flex-1 space-y-2">
				<div class="h-4 w-2/3 rounded-full bg-[var(--qx-line)] motion-safe:animate-pulse"></div>
				<div class="h-3 w-1/2 rounded-full bg-[var(--qx-line)] motion-safe:animate-pulse"></div>
			</div>
		</div>
		<div class="h-28 rounded-2xl bg-[var(--qx-line)] motion-safe:animate-pulse"></div>
		<div class="h-16 rounded-2xl bg-[var(--qx-line)] motion-safe:animate-pulse"></div>
		<div class="h-16 w-4/5 rounded-2xl bg-[var(--qx-line)] motion-safe:animate-pulse"></div>
	</div>
{:else}
	<div class="space-y-3" aria-busy="true" aria-live="polite">
		{#each Array.from({ length: lines }) as _, index (index)}
			<div
				class="h-4 rounded-full bg-[var(--qx-line)] motion-safe:animate-pulse"
				style="width: {index === lines - 1 ? 62 : 100}%"
			></div>
		{/each}
	</div>
{/if}

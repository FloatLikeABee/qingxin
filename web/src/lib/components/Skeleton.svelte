<script lang="ts">
	let { lines = 3 }: { lines?: number } = $props();
</script>

<div class="space-y-3" aria-busy="true" aria-live="polite">
	{#each Array.from({ length: lines }) as _, index (index)}
		<div
			class="h-4 rounded-full bg-[var(--qx-line)] motion-safe:animate-pulse"
			style="width: {index === lines - 1 ? 62 : 100}%"
		></div>
	{/each}
</div>

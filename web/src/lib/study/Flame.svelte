<script lang="ts">
	let { streak = 0 }: { streak?: number } = $props();
</script>

<div class="flex items-center gap-2 text-[var(--qx-primary)]">
	<span class="text-2xl" aria-hidden="true">🔥</span>
	<p class="text-base font-semibold">{streak} 天连续</p>
</div>

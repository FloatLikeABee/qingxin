<script lang="ts">
	let { percent, label }: { percent: number; label: string } = $props();

	const radius = 42;
	const circ = 2 * Math.PI * radius;
	const clamped = $derived(Math.max(0, Math.min(100, percent)));
	const dash = $derived((clamped / 100) * circ);
</script>

<div class="relative mx-auto h-44 w-44">
	<svg viewBox="0 0 100 100" class="h-full w-full -rotate-90" aria-hidden="true">
		<circle cx="50" cy="50" r={radius} fill="none" stroke="var(--qx-line)" stroke-width="10" />
		<circle
			cx="50"
			cy="50"
			r={radius}
			fill="none"
			stroke="var(--qx-primary)"
			stroke-width="10"
			stroke-linecap="round"
			stroke-dasharray="{dash} {circ}"
		/>
	</svg>
	<div class="absolute inset-0 flex flex-col items-center justify-center">
		<p class="font-[Outfit] text-3xl font-semibold">{Math.round(clamped)}%</p>
		<p class="text-sm text-[var(--qx-muted)]">{label}</p>
	</div>
</div>

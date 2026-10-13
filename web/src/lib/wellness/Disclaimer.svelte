<script lang="ts">
	import { DISCLAIMER } from './disclaimer';

	let { extra = '' }: { extra?: string } = $props();
</script>

<p class="text-sm text-[var(--qx-muted)]">{DISCLAIMER}{extra ? ` ${extra}` : ''}</p>

<script lang="ts">
	import StudyChrome from '#lib/study/StudyChrome.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<StudyChrome>
	{@render children()}
</StudyChrome>

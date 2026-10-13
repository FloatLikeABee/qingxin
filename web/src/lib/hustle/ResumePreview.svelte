<script lang="ts">
	import { A4_COLORS, resumePreviewClass, type ResumeContent } from './resume';

	let { content }: { content: ResumeContent } = $props();
</script>

<article
	class="{resumePreviewClass} text-sm leading-relaxed"
	style="background:{A4_COLORS.background};color:{A4_COLORS.text}"
	data-theme="light"
>
	<p class="muted text-xs tracking-[0.2em]">RESUME</p>
	<h1 class="mt-2 text-3xl font-semibold">{content.name || '姓名'}</h1>
	<p class="muted mt-1 text-base">{content.title || '求职方向'}</p>
	<p class="muted mt-2 text-sm">{content.email} {content.phone}</p>
	{#if content.summary}
		<h2 class="mt-8 text-sm font-semibold tracking-wide">简介</h2>
		<p class="mt-2">{content.summary}</p>
	{/if}
	{#if content.experience?.length}
		<h2 class="mt-8 text-sm font-semibold tracking-wide">经历</h2>
		{#each content.experience as item (item.company + item.years)}
			<p class="mt-3 font-medium">{item.company} · {item.role}</p>
			<p class="muted text-xs">{item.years}</p>
			<p class="mt-1">{item.bullets}</p>
		{/each}
	{/if}
	{#if content.education?.length}
		<h2 class="mt-8 text-sm font-semibold tracking-wide">教育</h2>
		{#each content.education as item (item.school + item.years)}
			<p class="mt-3">{item.school} · {item.degree} · {item.years}</p>
		{/each}
	{/if}
	{#if content.skills?.length}
		<h2 class="mt-8 text-sm font-semibold tracking-wide">技能</h2>
		<p class="mt-2">{content.skills.join(' · ')}</p>
	{/if}
</article>

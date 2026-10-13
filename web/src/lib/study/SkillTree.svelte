<script lang="ts">
	import type { StudySkill } from './types';

	let {
		nodes,
		ontoggle
	}: {
		nodes: StudySkill[];
		ontoggle?: (id: string) => void;
	} = $props();

	function childrenOf(parentId: string | null): StudySkill[] {
		return nodes.filter((node) => node.parentId === parentId);
	}
</script>

<ul class="space-y-2">
	{#each childrenOf(null) as root (root.id)}
		<li class="rounded-2xl border border-[var(--qx-line)] bg-[var(--qx-card)] p-4">
			<button
				type="button"
				class="text-left text-base font-semibold"
				onclick={() => ontoggle?.(root.id)}
			>
				{root.unlocked ? '●' : '○'}
				{root.title}
			</button>
			{#if childrenOf(root.id).length}
				<ul class="mt-2 space-y-1 border-l border-dashed border-[var(--qx-line)] pl-4">
					{#each childrenOf(root.id) as child (child.id)}
						<li>
							<button
								type="button"
								class="text-left text-base text-[var(--qx-muted)]"
								onclick={() => ontoggle?.(child.id)}
							>
								{child.unlocked ? '●' : '○'}
								{child.title}
							</button>
							{#each childrenOf(child.id) as leaf (leaf.id)}
								<button
									type="button"
									class="ml-4 block text-left text-sm"
									onclick={() => ontoggle?.(leaf.id)}
								>
									{leaf.unlocked ? '●' : '○'}
									{leaf.title}
								</button>
							{/each}
						</li>
					{/each}
				</ul>
			{/if}
		</li>
	{/each}
</ul>

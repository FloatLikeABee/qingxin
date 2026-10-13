<script lang="ts">
	import { dismissToast, toasts } from '../toast';
</script>

<div class="pointer-events-none fixed inset-x-0 top-4 z-[60] mx-auto flex w-[min(92vw,420px)] flex-col gap-2">
	{#each $toasts as toast (toast.id)}
		<div
			class="pointer-events-auto rounded-2xl px-4 py-3 text-base shadow-lg ring-1 ring-white/10 motion-safe:animate-[qx-rise_280ms_ease-out] {toast.tone ===
			'danger'
				? 'bg-rose-600 text-white'
				: toast.tone === 'success'
					? 'bg-emerald-600 text-white'
					: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'}"
			role="status"
		>
			<div class="flex items-start justify-between gap-3">
				<div>
					<p class="font-medium">{toast.title}</p>
					{#if toast.body}
						<p class="text-sm opacity-80">{toast.body}</p>
					{/if}
				</div>
				<button class="min-h-11 min-w-11 text-lg" onclick={() => dismissToast(toast.id)} aria-label="关闭提示">
					×
				</button>
			</div>
		</div>
	{/each}
</div>

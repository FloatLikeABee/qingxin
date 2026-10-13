<script lang="ts">
	import { persistConsent, readConsent, type ConsentState } from '../consent';
	import Button from './Button.svelte';
	import Modal from './Modal.svelte';

	let consent = $state<ConsentState>('unknown');
	let open = $state(false);

	$effect(() => {
		consent = readConsent();
		open = consent === 'unknown';
	});

	function accept() {
		persistConsent('accepted');
		consent = 'accepted';
		open = false;
	}

	function reject() {
		persistConsent('rejected');
		consent = 'rejected';
		open = false;
	}
</script>

<Modal bind:open title="欢迎来到轻心" dismissible={false}>
	<p>轻心遵循最小必要原则采集数据。首次使用前，请阅读并同意隐私政策。</p>
	<p>
		本应用仅提供工具辅助与信息展示，<strong class="text-[var(--qx-text)]">不提供医疗诊断、金融理财建议或法律咨询</strong>。
	</p>
	<p>
		你可以随时在设置中导出或删除本地数据。完整说明见
		<a class="text-[var(--qx-primary)] underline" href="/privacy">隐私政策</a>。
	</p>
	{#snippet footer()}
		<Button onclick={accept}>同意并继续</Button>
		<Button variant="secondary" onclick={reject}>仅浏览，暂不授权</Button>
	{/snippet}
</Modal>

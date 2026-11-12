<script lang="ts">
	import { onMount } from 'svelte';
	import { getApi } from '#lib/api/client';
	import Button from '#lib/components/Button.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import { envelopesOnBoard, type Envelope, type SecretThread } from '#lib/secrets/board';
	import { assertCanSendSecret, SECRET_CONSENT_COPY } from '#lib/secrets/consent';
	import { SECRET_DISCLAIMER } from '#lib/secrets/letter';
	import { HOTLINE_NAME, hotlineHref } from '#lib/mood/hotline';
	import { LINK_CLASS } from '#lib/ui/affordance';
	import { pushToast } from '#lib/toast';

	let needLogin = $state(false);
	let pending = $state(false);
	let consented = $state(false);
	let title = $state('未署名的信');
	let body = $state('');
	let threads = $state<SecretThread[]>([]);
	let opened = $state<Envelope | null>(null);
	const board = $derived(envelopesOnBoard(threads));

	onMount(() => {
		void (async () => {
			const session = await getApi().getSession();
			if (!session) {
				needLogin = true;
				return;
			}
			try {
				threads = await getApi().listSecretLetters();
			} catch {
				threads = [];
			}
		})();
	});

	async function sendLetter() {
		const checked = assertCanSendSecret({ body, consented });
		if (!checked.ok) {
			pushToast({ title: checked.reason, tone: 'danger' });
			return;
		}
		pending = true;
		try {
			const thread = await getApi().postSecretLetter({
				title: title.trim() || '未署名的信',
				body: checked.body,
				consent: true
			});
			threads = [thread, ...threads];
			body = '';
			opened = {
				...thread.reply,
				kind: 'envelope',
				layout: 'board',
				from: 'mailbox',
				pairId: thread.id
			};
			pushToast({ title: '信已投进格子，回信贴在板上', tone: 'success' });
		} catch {
			pushToast({ title: '这封信还没送出', tone: 'danger' });
		}
		pending = false;
	}
</script>

<svelte:head>
	<title>轻心 · 秘密信箱</title>
</svelte:head>

<section class="mailbox mx-auto max-w-4xl min-w-0 pb-10">
	<p class="mb-5">
		<a class={LINK_CLASS} href="/modules">← 返回模块中心</a>
	</p>

	<header class="mailbox-hero">
		<div class="mailbox-slot" aria-hidden="true">
			<span class="mailbox-flag"></span>
			<span class="mailbox-door"></span>
		</div>
		<div>
			<h1>秘密信箱</h1>
			<p>
				把不想公开的话写成一封信。信箱会回一封信，贴在你的木板上。这里不是聊天，也不会把信贴到街上。
			</p>
		</div>
	</header>

	{#if needLogin}
		<div class="mailbox-paper">
			<EmptyState title="登录后才能投信" body="秘密只存在你的账户里，本机不会另外存一份。">
				{#snippet action()}
					<Button href="/login">去登录</Button>
				{/snippet}
			</EmptyState>
		</div>
	{:else}
		<form
			class="mailbox-paper"
			onsubmit={(event) => {
				event.preventDefault();
				void sendLetter();
			}}
		>
			<label class="mailbox-field">
				<span>信封上的几个字</span>
				<input bind:value={title} maxlength="40" />
			</label>
			<label class="mailbox-field">
				<span>信纸</span>
				<textarea
					bind:value={body}
					rows="7"
					maxlength="4000"
					placeholder="写给信箱的话，不必署名。"
				></textarea>
			</label>
			<label class="mailbox-consent">
				<input type="checkbox" bind:checked={consented} />
				<span>{SECRET_CONSENT_COPY}</span>
			</label>
			<Button type="submit" disabled={pending}>投进信箱</Button>
		</form>
	{/if}

	<section class="mailbox-board" aria-label="信板">
		<h2>木板上的信</h2>
		{#if board.length === 0}
			<p class="mailbox-empty">今天还没有信。写完一封，回信会钉在这里。</p>
		{:else}
			<ul class="mailbox-grid">
				{#each board as item (item.id)}
					<li>
						<button
							type="button"
							class="envelope envelope-{item.from}"
							aria-expanded={opened?.id === item.id}
							onclick={() => (opened = opened?.id === item.id ? null : item)}
						>
							<span class="wax" aria-hidden="true"></span>
							<span class="stamp">{item.from === 'me' ? '投出' : '回信'}</span>
							<strong>{item.title}</strong>
							<em>{item.from === 'me' ? '你写的' : '信箱写的'}</em>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if opened}
		<article class="mailbox-open" aria-live="polite">
			<p class="mailbox-open-meta">{opened.from === 'me' ? '你的信' : '信箱的回信'}</p>
			<h2>{opened.title}</h2>
			<pre>{opened.body}</pre>
			<button type="button" class="mailbox-close" onclick={() => (opened = null)}>折好放回</button>
		</article>
	{/if}

	<footer class="mailbox-foot">
		<p>{SECRET_DISCLAIMER}</p>
		<p>
			<a class={LINK_CLASS} href={hotlineHref()}>{HOTLINE_NAME}</a>
		</p>
	</footer>
</section>

<style>
	.mailbox {
		color: #3a2a1c;
	}

	.mailbox-hero {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 1.25rem;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.mailbox-hero h1 {
		font-family: Georgia, 'Songti SC', serif;
		font-size: 2.25rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		line-height: 1.2;
	}

	.mailbox-hero p {
		margin-top: 0.6rem;
		max-width: 36rem;
		font-size: 1.05rem;
		line-height: 1.7;
		color: #5c4633;
	}

	.mailbox-slot {
		position: relative;
		width: 5.5rem;
		height: 6.5rem;
		border-radius: 0.7rem 0.7rem 0.4rem 0.4rem;
		background: linear-gradient(180deg, #d4554a 0%, #b13b38 70%, #8e2e2c 100%);
		box-shadow:
			0 18px 30px -18px #7a241f,
			inset 0 1px 0 #f08a7a;
	}

	.mailbox-door {
		position: absolute;
		left: 0.7rem;
		right: 0.7rem;
		top: 1.6rem;
		height: 1.5rem;
		border-radius: 0.2rem;
		background: #2c2118;
		box-shadow: inset 0 8px 0 #1b140f;
	}

	.mailbox-flag {
		position: absolute;
		right: -0.55rem;
		top: 1.1rem;
		width: 0.28rem;
		height: 2.2rem;
		background: #eab308;
		border-radius: 1px;
	}

	.mailbox-flag::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0.28rem;
		border-style: solid;
		border-width: 0.45rem 0 0.45rem 0.85rem;
		border-color: transparent transparent transparent #eab308;
	}

	.mailbox-paper,
	.mailbox-open {
		background: #f6ead2;
		background-image:
			linear-gradient(180deg, rgba(255, 255, 255, 0.35), transparent 18%),
			repeating-linear-gradient(
				transparent,
				transparent 1.7rem,
				rgba(180, 140, 90, 0.18) 1.7rem,
				rgba(180, 140, 90, 0.18) 1.78rem
			);
		border-radius: 0.4rem;
		padding: 1.4rem 1.5rem 1.6rem;
		box-shadow:
			0 22px 40px -28px #7a5a32,
			0 0 0 1px #e3cba3;
		color: #3a2a1c;
	}

	.mailbox-field {
		display: block;
		margin-bottom: 1rem;
	}

	.mailbox-field span {
		display: block;
		margin-bottom: 0.4rem;
		font-size: 0.95rem;
	}

	.mailbox-field input,
	.mailbox-field textarea {
		width: 100%;
		min-height: 2.75rem;
		border: 0;
		border-bottom: 1px solid #c9ae86;
		background: transparent;
		color: #3a2a1c;
		font: inherit;
		font-size: 1rem;
		padding: 0.4rem 0;
		outline: none;
	}

	.mailbox-field textarea {
		min-height: 10rem;
		resize: vertical;
		line-height: 1.7rem;
	}

	.mailbox-field input:focus-visible,
	.mailbox-field textarea:focus-visible,
	.mailbox-consent input:focus-visible,
	.envelope:focus-visible,
	.mailbox-close:focus-visible {
		outline: 2px solid #b13b38;
		outline-offset: 3px;
	}

	.mailbox-consent {
		display: flex;
		gap: 0.7rem;
		align-items: flex-start;
		margin: 1rem 0 1.2rem;
		font-size: 0.95rem;
		line-height: 1.6;
	}

	.mailbox-consent input {
		margin-top: 0.3rem;
		width: 1.1rem;
		height: 1.1rem;
		accent-color: #b13b38;
	}

	.mailbox-board {
		margin-top: 2rem;
		padding: 1.25rem;
		border-radius: 1rem;
		background:
			radial-gradient(circle at 20% 10%, rgba(255, 255, 255, 0.18), transparent 28%), #c4a574;
		box-shadow: inset 0 0 0 1px #a78652;
	}

	.mailbox-board h2,
	.mailbox-open h2 {
		font-family: Georgia, 'Songti SC', serif;
		font-size: 1.35rem;
		margin-bottom: 0.8rem;
	}

	.mailbox-empty {
		color: #5c4633;
	}

	.mailbox-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr));
		gap: 0.9rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.envelope {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		min-height: 8.5rem;
		width: 100%;
		padding: 1rem 0.9rem 0.8rem;
		border: 0;
		text-align: left;
		cursor: pointer;
		color: #3a2a1c;
		background: #f3e2c2;
		clip-path: polygon(0 18%, 50% 0, 100% 18%, 100% 100%, 0 100%);
		box-shadow: 0 10px 18px -14px #5c4633;
	}

	.envelope-mailbox {
		background: #e7f0e4;
	}

	.envelope strong {
		margin-top: 1.4rem;
		font-size: 1rem;
	}

	.envelope em {
		margin-top: 0.25rem;
		font-style: normal;
		font-size: 0.85rem;
		color: #6b5340;
	}

	.wax {
		width: 1.15rem;
		height: 1.15rem;
		border-radius: 999px;
		background: radial-gradient(circle at 35% 30%, #e88984, #b13b38 62%);
	}

	.envelope-mailbox .wax {
		background: radial-gradient(circle at 35% 30%, #7dcdc0, #2a6f6a 62%);
	}

	.stamp {
		position: absolute;
		align-self: flex-end;
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		color: #7a241f;
	}

	.mailbox-open {
		margin-top: 1.25rem;
	}

	.mailbox-open pre {
		white-space: pre-wrap;
		font-family: Georgia, 'Songti SC', serif;
		font-size: 1.05rem;
		line-height: 1.8;
		margin: 0.4rem 0 1rem;
	}

	.mailbox-open-meta {
		font-size: 0.9rem;
		color: #6b5340;
	}

	.mailbox-close {
		min-height: 2.75rem;
		border: 0;
		background: transparent;
		color: #b13b38;
		text-decoration: underline;
		text-underline-offset: 0.25em;
		font: inherit;
		cursor: pointer;
	}

	.mailbox-foot {
		margin-top: 1.5rem;
		font-size: 0.9rem;
		color: #6b5340;
	}

	:global(.dark) .mailbox {
		color: #f6ead2;
	}

	:global(.dark) .mailbox-hero p,
	:global(.dark) .mailbox-empty,
	:global(.dark) .mailbox-foot,
	:global(.dark) .mailbox-open-meta {
		color: #d7c4a6;
	}

	@media (max-width: 40rem) {
		.mailbox-hero {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>

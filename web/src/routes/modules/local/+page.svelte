<script lang="ts">
	import { onMount } from 'svelte';
	import { getApi } from '#lib/api/client';
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Input from '#lib/components/Input.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import Tag from '#lib/components/Tag.svelte';
	import Textarea from '#lib/components/Textarea.svelte';
	import {
		CATEGORIES,
		COMMUNITY_ORIGIN,
		CORRECTION_KINDS,
		ELDER_TAGS,
		categoryIcon,
		defaultHero,
		type CorrectionKind,
		type ElderTag,
		type LocalCategory,
		type LocalReview,
		type LocalService
	} from '#lib/local/catalog';
	import { formatDistance } from '#lib/local/geo';
	import { heroGradient } from '#lib/local/hero';
	import LocalMap from '#lib/local/LocalMap.svelte';
	import {
		currentMapEnv,
		selectMapProvider,
		type MapProviderId,
		type MapTheme
	} from '#lib/local/map';
	import {
		cacheReviews,
		cacheServices,
		loadCachedReviews,
		loadCachedServices,
		saveCorrection,
		saveReview,
		saveService
	} from '#lib/local/store';
	import { validatePublish, validateReview } from '#lib/local/validate';
	import { pushToast } from '#lib/toast';

	let needLogin = $state(false);
	let view = $state<'map' | 'list'>('map');
	let query = $state('');
	let category = $state<LocalCategory | ''>('');
	let sort = $state<'distance' | 'rating'>('distance');
	let services = $state<LocalService[]>([]);
	let selectedId = $state('');
	let detail = $state<LocalService | null>(null);
	let reviews = $state<LocalReview[]>([]);
	let reviewText = $state('');
	let publishOpen = $state(false);
	let pending = $state(false);
	let theme = $state<MapTheme>('light');
	let provider = $state<MapProviderId>('stub');
	let formName = $state('');
	let formCategory = $state<LocalCategory>('维修');
	let formAddress = $state('');
	let formPhone = $state('');
	let formHours = $state('09:00–18:00');
	let formTags = $state<ElderTag[]>([]);
	let formLat = $state(String(COMMUNITY_ORIGIN.lat));
	let formLng = $state(String(COMMUNITY_ORIGIN.lng));

	const selected = $derived(services.find((item) => item.id === selectedId) ?? null);

	onMount(() => {
		theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
		provider = selectMapProvider(currentMapEnv());
		void boot();
	});

	async function boot() {
		const session = await getApi().getSession();
		if (!session) {
			needLogin = true;
			return;
		}
		needLogin = false;
		await refresh();
	}

	async function refresh() {
		let listed: LocalService[] = [];
		try {
			listed = await getApi().listLocalServices({
				q: query || undefined,
				category: category || undefined,
				sort
			});
		} catch {
			listed = [];
		}
		const cached = await loadCachedServices();
		services = listed.length ? listed : cached;
		for (const item of cached) {
			if (!services.some((row) => row.id === item.id)) services = [item, ...services];
		}
		if (services.length) await cacheServices(services);
		if (selectedId && !services.some((item) => item.id === selectedId))
			selectedId = services[0]?.id ?? '';
		if (!selectedId && services[0]) selectedId = services[0].id;
	}

	async function openDetail(id: string) {
		selectedId = id;
		try {
			detail = await getApi().getLocalService(id);
			reviews = await getApi().listLocalReviews(id);
			await cacheReviews(id, reviews);
		} catch {
			detail = services.find((item) => item.id === id) ?? null;
			reviews = await loadCachedReviews(id);
		}
	}

	function closeDetail() {
		detail = null;
		reviewText = '';
	}

	async function submitReview() {
		if (!detail) return;
		const checked = validateReview({ content: reviewText, rating: 5 });
		if (!checked.ok) {
			pushToast({ title: checked.message, tone: 'danger' });
			return;
		}
		pending = true;
		const previous = reviews;
		try {
			const saved = await saveReview(
				detail.id,
				{ content: checked.value.content, rating: 5 },
				(row) => {
					reviews = [row, ...reviews];
				},
				() => {
					reviews = previous;
				}
			);
			reviews = [saved, ...previous.filter((item) => item.id !== saved.id)];
			reviewText = '';
			pushToast({ title: '评价已记下', tone: 'success' });
			await refresh();
		} catch {
			pushToast({ title: '没能写下评价', tone: 'danger' });
		}
		pending = false;
	}

	async function flag(kind: CorrectionKind) {
		if (!detail) return;
		try {
			await saveCorrection(
				detail.id,
				{ kind },
				() => undefined,
				() => undefined
			);
			try {
				detail = await getApi().getLocalService(detail.id);
			} catch {
				/* offline: keep the open card */
			}
			pushToast({ title: `已标记${kind}`, tone: 'success' });
		} catch {
			pushToast({ title: '没能提交纠错', tone: 'danger' });
		}
	}

	async function publish() {
		const checked = validatePublish({
			name: formName,
			category: formCategory,
			address: formAddress,
			latitude: Number(formLat),
			longitude: Number(formLng),
			hours: formHours,
			phone: formPhone,
			tags: formTags
		});
		if (!checked.ok) {
			pushToast({ title: checked.message, tone: 'danger' });
			return;
		}
		pending = true;
		try {
			const created = await saveService(
				{
					name: checked.value.name,
					category: checked.value.category,
					address: checked.value.address,
					latitude: checked.value.latitude,
					longitude: checked.value.longitude,
					hours: formHours,
					phone: formPhone,
					tags: formTags
				},
				(row) => {
					services = [row, ...services.filter((item) => item.id !== row.id)];
					selectedId = row.id;
					void cacheServices(services);
				},
				() => undefined
			);
			publishOpen = false;
			formName = '';
			formAddress = '';
			pushToast({ title: '已提交到生活圈', tone: 'success' });
			await refresh();
			selectedId = created.id;
		} catch {
			pushToast({ title: '没能发布', tone: 'danger' });
		}
		pending = false;
	}

	function toggleTag(tag: ElderTag) {
		formTags = formTags.includes(tag)
			? formTags.filter((item) => item !== tag)
			: [...formTags, tag];
	}

	function telHref(phone?: string | null) {
		return phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : undefined;
	}

	function geoHref(service: LocalService) {
		return `geo:${service.latitude},${service.longitude}?q=${encodeURIComponent(service.address)}`;
	}
</script>

<svelte:head>
	<title>轻心 · 本地生活</title>
</svelte:head>

{#if !detail}
	<section class="mx-auto max-w-3xl space-y-4 pb-28">
		<a href="/modules" class="inline-flex min-h-11 items-center text-base text-[var(--qx-muted)]"
			>← 返回模块中心</a
		>
		<div class="flex items-start justify-between gap-3">
			<div>
				<Tag tone="primary">15 分钟生活圈</Tag>
				<h1 class="mt-2 text-3xl font-semibold">本地生活</h1>
				<p class="mt-2 text-base text-[var(--qx-muted)]">
					附近的维修、宠物、配送与适老服务。先看再决定，不构成消费或医疗建议。
				</p>
			</div>
			<Button variant="secondary" class="shrink-0" onclick={() => (publishOpen = true)}>发布</Button
			>
		</div>

		{#if needLogin}
			<Card>
				<EmptyState
					title="先登录再看附近"
					body="登录后可以浏览生活圈、打电话，并把纠错记下来。"
					icon="spark"
				>
					{#snippet action()}
						<Button href="/login">去登录</Button>
					{/snippet}
				</EmptyState>
			</Card>
		{:else}
			<Input
				label="搜索附近"
				placeholder="试试 宠物医院"
				bind:value={query}
				oninput={() => void refresh()}
			/>

			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					class="min-h-11 rounded-2xl px-4 text-base {view === 'map'
						? 'bg-[var(--qx-primary)] text-white'
						: 'bg-[var(--qx-card)] text-[var(--qx-text)] ring-1 ring-[var(--qx-line)]'}"
					onclick={() => (view = 'map')}
				>
					地图
				</button>
				<button
					type="button"
					class="min-h-11 rounded-2xl px-4 text-base {view === 'list'
						? 'bg-[var(--qx-primary)] text-white'
						: 'bg-[var(--qx-card)] text-[var(--qx-text)] ring-1 ring-[var(--qx-line)]'}"
					onclick={() => (view = 'list')}
				>
					列表
				</button>
				<button
					type="button"
					class="min-h-11 rounded-2xl px-4 text-base {sort === 'distance'
						? 'bg-[var(--qx-card)] ring-2 ring-[var(--qx-primary)]'
						: 'bg-[var(--qx-surface)] text-[var(--qx-muted)]'}"
					onclick={() => {
						sort = 'distance';
						void refresh();
					}}
				>
					按距离
				</button>
				<button
					type="button"
					class="min-h-11 rounded-2xl px-4 text-base {sort === 'rating'
						? 'bg-[var(--qx-card)] ring-2 ring-[var(--qx-primary)]'
						: 'bg-[var(--qx-surface)] text-[var(--qx-muted)]'}"
					onclick={() => {
						sort = 'rating';
						void refresh();
					}}
				>
					按评分
				</button>
			</div>

			{#if view === 'map'}
				<LocalMap
					{services}
					{selectedId}
					{theme}
					{provider}
					onselect={(id) => {
						selectedId = id;
					}}
				/>
			{:else}
				<div class="space-y-3">
					{#each services as service (service.id)}
						<button
							type="button"
							class="local-service-card w-full rounded-3xl bg-[var(--qx-card)] p-4 text-left ring-1 ring-[var(--qx-line)]"
							onclick={() => void openDetail(service.id)}
						>
							<div class="flex items-start gap-3">
								<div
									class="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
									style:background={heroGradient(service.heroKey ?? service.category)}
								>
									<Icon name={categoryIcon(service.category)} />
								</div>
								<div class="min-w-0 flex-1">
									<p class="text-lg font-semibold">{service.name}</p>
									<p class="text-sm text-[var(--qx-muted)]">
										{service.category} · {formatDistance(service.distanceM)} · {service.ratingAvg.toFixed(
											1
										)}
									</p>
									<p class="truncate text-sm text-[var(--qx-muted)]">{service.address}</p>
									<div class="mt-2 flex flex-wrap gap-1">
										{#each service.tags as tag (tag)}
											<Tag>{tag}</Tag>
										{/each}
									</div>
								</div>
							</div>
						</button>
					{/each}
				</div>
			{/if}

			<div class="flex flex-wrap gap-2">
				{#each CATEGORIES as item (item)}
					<button
						type="button"
						class="min-h-11 rounded-full px-4 text-base {category === item
							? 'bg-[var(--qx-primary)] text-white'
							: 'bg-[var(--qx-surface)] text-[var(--qx-text)]'}"
						onclick={() => {
							category = category === item ? '' : item;
							void refresh();
						}}
					>
						{item}
					</button>
				{/each}
			</div>

			{#if selected && view === 'map'}
				<Card class="local-service-card">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="text-lg font-semibold">{selected.name}</p>
							<p class="text-sm text-[var(--qx-muted)]">
								{selected.category} · {formatDistance(selected.distanceM)} · {selected.ratingAvg.toFixed(
									1
								)}
							</p>
							<p class="mt-1 text-sm">{selected.address}</p>
						</div>
						<Button onclick={() => void openDetail(selected.id)}>查看</Button>
					</div>
				</Card>
			{/if}
		{/if}
	</section>
{/if}

{#if detail}
	<div class="min-h-screen bg-[var(--qx-bg)] pb-8">
		<div
			class="h-52 w-full"
			style:background={heroGradient(detail.heroKey ?? defaultHero(detail.category))}
		>
			<div class="mx-auto flex h-full max-w-3xl items-end px-5 pb-5 text-white">
				<div>
					<p class="text-sm opacity-90">{detail.category}</p>
					<h2 class="text-3xl font-semibold">{detail.name}</h2>
				</div>
			</div>
		</div>
		<div class="mx-auto max-w-3xl space-y-4 px-5 py-5 pb-28">
			<Button variant="ghost" onclick={closeDetail}>← 返回地图</Button>
			<Card class="local-service-card">
				<p class="text-base">{detail.address}</p>
				<p class="mt-2 text-sm text-[var(--qx-muted)]">营业 {detail.hours ?? '以店内为准'}</p>
				<p class="mt-1 text-sm text-[var(--qx-muted)]">电话 {detail.phone ?? '暂无'}</p>
				<div class="mt-3 flex flex-wrap gap-2">
					{#each detail.tags as tag (tag)}
						<Tag tone="warm">{tag}</Tag>
					{/each}
				</div>
				<p class="mt-3 text-sm text-[var(--qx-muted)]">
					纠错 {detail.correctionCounts?.['已搬迁'] ?? 0} 已搬迁 · {detail.correctionCounts?.[
						'电话空号'
					] ?? 0} 电话空号
				</p>
			</Card>
			<div>
				<h3 class="mb-2 text-lg font-semibold">评价</h3>
				{#each reviews as review (review.id)}
					<Card class="mb-3">
						<p>{review.content}</p>
						<p class="mt-1 text-sm text-[var(--qx-muted)]">{review.rating ?? '—'} 分</p>
					</Card>
				{/each}
				<Textarea label="写下你的体验" bind:value={reviewText} />
				<Button class="mt-3" disabled={pending} onclick={() => void submitReview()}>发表评价</Button
				>
			</div>
			<div class="flex flex-wrap gap-2">
				{#each CORRECTION_KINDS as kind (kind)}
					<Button variant="secondary" onclick={() => void flag(kind)}>{kind}</Button>
				{/each}
			</div>
		</div>
		<div
			class="fixed right-0 bottom-0 left-0 z-50 border-t border-[var(--qx-line)] bg-[var(--qx-card)]/95 px-5 py-3 backdrop-blur"
		>
			<div class="mx-auto flex max-w-3xl gap-3">
				<Button class="flex-1" href={telHref(detail.phone)} disabled={!detail.phone}>拨打</Button>
				<Button class="flex-1" variant="secondary" href={geoHref(detail)}>导航</Button>
			</div>
		</div>
	</div>
{/if}

<Modal bind:open={publishOpen} title="发布附近服务">
	<Input label="店名" bind:value={formName} />
	<div class="flex flex-wrap gap-2">
		{#each CATEGORIES as item (item)}
			<button
				type="button"
				class="min-h-11 rounded-full px-4 {formCategory === item
					? 'bg-[var(--qx-primary)] text-white'
					: 'bg-[var(--qx-surface)]'}"
				onclick={() => (formCategory = item)}
			>
				{item}
			</button>
		{/each}
	</div>
	<Input label="地址" bind:value={formAddress} />
	<Input label="电话" bind:value={formPhone} />
	<Input label="营业时间" bind:value={formHours} />
	<div class="flex flex-wrap gap-2">
		{#each ELDER_TAGS as tag (tag)}
			<button
				type="button"
				class="min-h-11 rounded-full px-4 {formTags.includes(tag)
					? 'bg-[var(--qx-primary)] text-white'
					: 'bg-[var(--qx-surface)]'}"
				onclick={() => toggleTag(tag)}
			>
				{tag}
			</button>
		{/each}
	</div>
	{#snippet footer()}
		<Button disabled={pending} onclick={() => void publish()}>提交</Button>
	{/snippet}
</Modal>

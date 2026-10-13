<script lang="ts">
	import { COMMUNITY_ORIGIN, type LocalService } from './catalog';
	import {
		markerFill,
		osmTileUrl,
		projectMarker,
		stubBackground,
		type MapProviderId,
		type MapTheme
	} from './map';
	import Icon from '../components/Icon.svelte';

	let {
		services,
		selectedId = '',
		theme = 'light',
		provider = 'stub',
		onselect
	}: {
		services: LocalService[];
		selectedId?: string;
		theme?: MapTheme;
		provider?: MapProviderId;
		onselect?: (id: string) => void;
	} = $props();

	const width = 640;
	const height = 420;
	const origin = $derived(
		projectMarker(
			{ latitude: COMMUNITY_ORIGIN.lat, longitude: COMMUNITY_ORIGIN.lng },
			services,
			width,
			height
		)
	);
	const bg = $derived(stubBackground(theme));
	const grid = $derived(theme === 'dark' ? '#374151' : '#d1d5db');
	const ring = $derived(theme === 'dark' ? '#60a5fa' : '#3b82f6');
	const label = $derived(theme === 'dark' ? '#e5e7eb' : '#1f2937');
</script>

<div
	class="local-map relative overflow-hidden rounded-[28px]"
	style:background={provider === 'stub' ? bg : undefined}
	data-provider={provider}
	data-theme={theme}
>
	{#if provider === 'osm'}
		<div
			class="absolute inset-0 bg-cover bg-center"
			style:background-image="url('{osmTileUrl(theme).replace('{z}/{x}/{y}', '16/54772/26770')}')"
		></div>
	{/if}
	<svg
		viewBox="0 0 {width} {height}"
		class="relative z-10 h-[min(52vh,420px)] w-full"
		role="img"
		aria-label="附近服务地图"
	>
		{#if provider === 'stub'}
			<rect {width} {height} fill={bg} />
			{#each [80, 160, 240, 320, 400, 480, 560] as x (x)}
				<line {x} x2={x} y1="0" y2={height} stroke={grid} stroke-width="1" opacity="0.55" />
			{/each}
			{#each [70, 140, 210, 280, 350] as y (y)}
				<line x1="0" x2={width} y1={y} y2={y} stroke={grid} stroke-width="1" opacity="0.55" />
			{/each}
			<circle
				cx={origin.x}
				cy={origin.y}
				r="92"
				fill="none"
				stroke={ring}
				stroke-dasharray="6 8"
				stroke-width="2"
				opacity="0.7"
			/>
			<text x="20" y="28" fill={label} font-size="14">{COMMUNITY_ORIGIN.name} · 15 分钟</text>
		{/if}
		{#each services as service (service.id)}
			{@const point = projectMarker(service, services, width, height)}
			{@const selected = service.id === selectedId}
			<g
				role="button"
				tabindex="0"
				transform="translate({point.x} {point.y})"
				onclick={() => onselect?.(service.id)}
				onkeydown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') onselect?.(service.id);
				}}
				aria-label={service.name}
				style="cursor:pointer"
			>
				{#if selected}
					<circle r="22" fill={markerFill(theme, true)} opacity="0.28" />
				{/if}
				<circle
					r={selected ? 11 : 8}
					fill={markerFill(theme, selected)}
					stroke={theme === 'dark' ? '#f9fafb' : '#ffffff'}
					stroke-width="2"
				/>
			</g>
		{/each}
	</svg>
	<div
		class="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1 rounded-full bg-black/35 px-3 py-1 text-xs text-white"
	>
		<Icon name="map" class="h-3.5 w-3.5" />
		{provider === 'osm' ? '地图数据 © OSM/Carto' : '示意地图 · 无钥匙'}
	</div>
</div>

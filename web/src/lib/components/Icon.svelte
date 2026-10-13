<script lang="ts">
	const icons = {
		cloud:
			'M7 16a4 4 0 0 1 .17-8A5 5 0 0 1 17 9h1a3.5 3.5 0 0 1 0 7H7z',
		wallet:
			'M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2H5v6h12v-2h2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8zm14 1.5h2V11h-2V9.5z',
		heart:
			'M12 20s-7-4.35-7-9.2C5 8 7 6 9.2 6c1.3 0 2.4.7 2.8 1.7C12.4 6.7 13.5 6 14.8 6 17 6 19 8 19 10.8 19 15.65 12 20 12 20z',
		map: 'M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2zm0 2.3 6 2v11.4l-6-2V6.3z',
		spark:
			'M12 3 13.8 9 20 10.8 13.8 12.6 12 19 10.2 12.6 4 10.8 10.2 9 12 3z',
		paw: 'M8 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm12 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 20c-2.8 0-5-1.6-5-3.6S9.2 13 12 13s5 1.5 5 3.4S14.8 20 12 20z',
		pulse:
			'M3 12h3l2-6 4 12 2-6h7',
		book: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H18v16H6.5A1.5 1.5 0 0 0 5 20.5V4.5zM8 7h7M8 11h7',
		pen: 'M4 16.5 15.5 5 19 8.5 7.5 20H4v-3.5zM13.5 7l3 3',
		briefcase:
			'M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2h4v13H4V7h4zm2 0h4V5h-4v2z',
		home: 'M4 11 12 4l8 7v9H4v-9zm4 9v-6h8v6',
		grid: 'M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z',
		kit: 'M8 4h8l2 4H6l2-4zm-3 5h14v11H5V9zm4 3v5m6-5v5',
		user: 'M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-7 8c0-3.3 3.1-5 7-5s7 1.7 7 5',
		sun: 'M12 5V3m0 18v-2M5 12H3m18 0h-2M6.3 6.3 5 5m14 14-1.3-1.3M17.7 6.3 19 5M5 19l1.3-1.3M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
		moon: 'M16 13a6 6 0 1 1-5-8 7 7 0 0 0 5 8z',
		check: 'M5 12.5 9.5 17 19 7',
		close: 'M6 6 18 18M18 6 6 18',
		plus: 'M12 5v14M5 12h14',
		info: 'M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
		download:
			'M12 4v10m0 0 4-4m-4 4-4-4M5 18h14',
		trash: 'M5 7h14M9 7V5h6v2m-8 0 1 13h8l1-13',
		wifi: 'M4.5 10A11 11 0 0 1 19.5 10M7.5 13.5A7 7 0 0 1 16.5 13.5M12 18h.01',
		lock: 'M8 10V8a4 4 0 1 1 8 0v2h2v10H6V10h2zm2 0h4V8a2 2 0 0 0-4 0v2z',
		logo: 'M8 16c0-5 3-9 8-11-2 4 1 7 5 8-6 1-9 4-9 8-3-2-4-4-4-5z',
		chevron: 'M9 6l6 6-6 6',
		bell: 'M6 16h12l-1.2-6.2A4.8 4.8 0 0 0 12 6a4.8 4.8 0 0 0-4.8 3.8L6 16zm4 3a2 2 0 0 0 4 0'
	} as const;

	type IconName = keyof typeof icons;

	let {
		name,
		class: className = 'h-5 w-5'
	}: {
		name: IconName | string;
		class?: string;
	} = $props();

	const path = $derived(icons[(name in icons ? name : 'info') as IconName]);
</script>

<svg class={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
	<path
		d={path}
		stroke="currentColor"
		stroke-width="1.7"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>

<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { _, locale } from 'svelte-i18n';
	import {
		Calendar,
		ChevronLeft,
		ChevronRight,
		Image as ImageIcon,
		Play,
		RotateCcw,
		Search,
		Video,
	} from 'lucide-svelte';
	import type { PublicEventMedia } from '$lib/types/eventMedia';
	import type { RueckblickPageData } from './+page.server';

	let { data } = $props<{ data: RueckblickPageData }>();

	let selectedEventId = $state(data.filters.eventId?.toString() ?? '');
	let dateFrom = $state(data.filters.dateFrom);
	let dateTo = $state(data.filters.dateTo);
	let sort = $state(data.filters.sort);
	let activeVideoId = $state<number | null>(null);
	let activeVideoElement = $state<HTMLVideoElement | null>(null);
	let failedMediaIds = $state<Set<number>>(new Set());
	let failedThumbnailIds = $state<Set<number>>(new Set());

	const items = $derived(data.items ?? []);
	const events = $derived(data.events ?? []);
	const pageNumbers = $derived(getPageNumbers(data.page, data.totalPages));

	$effect(() => {
		selectedEventId = data.filters.eventId?.toString() ?? '';
		dateFrom = data.filters.dateFrom;
		dateTo = data.filters.dateTo;
		sort = data.filters.sort;
	});

	function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
		const pages: (number | string)[] = [];
		const maxVisible = 5;

		if (totalPages <= maxVisible) {
			for (let i = 1; i <= totalPages; i += 1) {
				pages.push(i);
			}
		} else if (currentPage <= 3) {
			for (let i = 1; i <= 4; i += 1) {
				pages.push(i);
			}
			pages.push('...');
			pages.push(totalPages);
		} else if (currentPage >= totalPages - 2) {
			pages.push(1);
			pages.push('...');
			for (let i = totalPages - 3; i <= totalPages; i += 1) {
				pages.push(i);
			}
		} else {
			pages.push(1);
			pages.push('...');
			pages.push(currentPage - 1);
			pages.push(currentPage);
			pages.push(currentPage + 1);
			pages.push('...');
			pages.push(totalPages);
		}

		return pages;
	}

	function getLocalizedEventTitle(event: RueckblickPageData['events'][number]): string {
		const currentLocale = ($locale || 'de') as 'de' | 'en' | 'ru' | 'uk';
		const titles = {
			de: event.title_de,
			en: event.title_en || event.title_de,
			ru: event.title_ru || event.title_de,
			uk: event.title_uk || event.title_de,
		};

		return titles[currentLocale] || event.title_de;
	}

	function getMediaEventTitle(item: PublicEventMedia): string {
		if (item.media_scope !== 'event') {
			return $_('rueckblick.media.general');
		}

		const currentLocale = ($locale || 'de') as 'de' | 'en' | 'ru' | 'uk';
		const titles = {
			de: item.event_title_de,
			en: item.event_title_en || item.event_title_de,
			ru: item.event_title_ru || item.event_title_de,
			uk: item.event_title_uk || item.event_title_de,
		};

		return titles[currentLocale] || item.event_title_de || $_('rueckblick.media.general');
	}

	function formatMediaDate(item: PublicEventMedia): string {
		const dateValue = item.effective_date || item.captured_at || item.event_date;

		if (!dateValue) {
			return '';
		}

		try {
			const normalized = dateValue.includes('T') ? dateValue : dateValue.replace(' ', 'T');
			const date = new Date(normalized);

			if (Number.isNaN(date.getTime())) {
				return '';
			}

			return new Intl.DateTimeFormat($locale || 'de', {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
			}).format(date);
		} catch {
			return '';
		}
	}

	function getMediaAlt(item: PublicEventMedia): string {
		return item.alt_text?.trim() || getMediaEventTitle(item);
	}

	function buildPageHref(page: number): string {
		const params = new URLSearchParams();

		if (data.filters.eventId !== null) {
			params.set('eventId', data.filters.eventId.toString());
		}
		if (data.filters.dateFrom) {
			params.set('dateFrom', data.filters.dateFrom);
		}
		if (data.filters.dateTo) {
			params.set('dateTo', data.filters.dateTo);
		}
		if (data.filters.sort) {
			params.set('sort', data.filters.sort);
		}

		params.set('page', page.toString());
		return `?${params.toString()}`;
	}

	function markMediaFailed(itemId: number) {
		failedMediaIds = new Set(failedMediaIds).add(itemId);
		if (activeVideoId === itemId) {
			stopActiveVideo();
		}
	}

	function markThumbnailFailed(itemId: number) {
		failedThumbnailIds = new Set(failedThumbnailIds).add(itemId);
	}

	function stopActiveVideo() {
		if (activeVideoElement) {
			activeVideoElement.pause();
			activeVideoElement.currentTime = 0;
		}

		activeVideoId = null;
		activeVideoElement = null;
	}

	async function playVideo(item: PublicEventMedia) {
		stopActiveVideo();
		activeVideoId = item.id;
		await tick();

		try {
			await activeVideoElement?.play();
		} catch (error) {
			console.warn('Failed to play Rueckblick video:', error);
		}
	}

	onMount(() => {
		return () => stopActiveVideo();
	});
</script>

<svelte:head>
	<title>{$_('rueckblick.page.title')} | Berufsorientierung</title>
	<meta name="description" content={$_('rueckblick.page.description')} />
</svelte:head>

<main class="min-h-screen bg-gray-50">
	<section class="bg-white border-b border-gray-200">
		<div class="container mx-auto px-4 py-8 sm:py-12">
			<div class="max-w-3xl">
				<h1 class="text-3xl font-bold text-gray-900 sm:text-4xl">
					{$_('rueckblick.page.heading')}
				</h1>
				<p class="mt-3 text-lg text-gray-600">
					{$_('rueckblick.page.description')}
				</p>
			</div>
		</div>
	</section>

	<section class="container mx-auto px-4 py-8 sm:py-12">
		<form
			method="GET"
			class="mb-8 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
		>
			<input type="hidden" name="page" value="1" />

			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
				<label class="flex flex-col gap-2">
					<span class="text-sm font-medium text-gray-700">
						{$_('rueckblick.filters.event')}
					</span>
					<select
						name="eventId"
						bind:value={selectedEventId}
						class="min-h-[44px] rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="">{$_('rueckblick.filters.allEvents')}</option>
						{#each events as event (event.id)}
							<option value={event.id.toString()}>{getLocalizedEventTitle(event)}</option>
						{/each}
					</select>
				</label>

				<label class="flex flex-col gap-2">
					<span class="text-sm font-medium text-gray-700">
						{$_('rueckblick.filters.dateFrom')}
					</span>
					<input
						type="date"
						name="dateFrom"
						bind:value={dateFrom}
						class="min-h-[44px] rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</label>

				<label class="flex flex-col gap-2">
					<span class="text-sm font-medium text-gray-700">
						{$_('rueckblick.filters.dateTo')}
					</span>
					<input
						type="date"
						name="dateTo"
						bind:value={dateTo}
						class="min-h-[44px] rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</label>

				<label class="flex flex-col gap-2">
					<span class="text-sm font-medium text-gray-700">
						{$_('rueckblick.filters.sort')}
					</span>
					<select
						name="sort"
						bind:value={sort}
						class="min-h-[44px] rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="newest">{$_('rueckblick.sort.newest')}</option>
						<option value="oldest">{$_('rueckblick.sort.oldest')}</option>
					</select>
				</label>

				<div class="flex items-end gap-2">
					<button
						type="submit"
						class="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
					>
						<Search size={18} aria-hidden="true" />
						{$_('rueckblick.filters.apply')}
					</button>
					<a
						href="/rueckblick"
						class="inline-flex min-h-[44px] items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
						aria-label={$_('rueckblick.filters.reset')}
					>
						<RotateCcw size={18} aria-hidden="true" />
					</a>
				</div>
			</div>
		</form>

		{#if items.length > 0}
			<div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each items as item (item.id)}
					{@const mediaFailed = failedMediaIds.has(item.id)}
					{@const thumbnailFailed = failedThumbnailIds.has(item.id)}
					<article class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
						<div class="relative aspect-[4/3] overflow-hidden bg-gray-100">
							{#if mediaFailed}
								<div class="flex h-full w-full flex-col items-center justify-center gap-3 bg-gray-100 p-4 text-center text-gray-500">
									{#if item.media_type === 'video'}
										<Video size={32} aria-hidden="true" />
										<span class="text-sm font-medium">{$_('rueckblick.media.videoUnavailable')}</span>
									{:else}
										<ImageIcon size={32} aria-hidden="true" />
										<span class="text-sm font-medium">{$_('rueckblick.media.imageUnavailable')}</span>
									{/if}
								</div>
							{:else if item.media_type === 'image'}
								<img
									src={item.public_url}
									alt={getMediaAlt(item)}
									class="h-full w-full object-cover"
									loading="lazy"
									decoding="async"
									onerror={() => markMediaFailed(item.id)}
								/>
							{:else if activeVideoId === item.id}
								<!-- svelte-ignore a11y_media_has_caption (caption files are not part of the current media schema) -->
								<video
									bind:this={activeVideoElement}
									class="h-full w-full bg-black object-contain"
									src={item.public_url}
									preload="none"
									controls
									playsinline
									aria-label={$_('rueckblick.media.play')}
									onerror={() => markMediaFailed(item.id)}
								></video>
							{:else}
								{#if item.thumbnail_url && !thumbnailFailed}
									<img
										src={item.thumbnail_url}
										alt={getMediaAlt(item)}
										class="h-full w-full object-cover"
										loading="lazy"
										decoding="async"
										onerror={() => markThumbnailFailed(item.id)}
									/>
								{:else}
									<div class="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400">
										<Video size={36} aria-hidden="true" />
									</div>
								{/if}

								<button
									type="button"
									class="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
									aria-label={$_('rueckblick.media.play')}
									onclick={() => playVideo(item)}
								>
									<span
										class="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-colors hover:bg-blue-700"
										aria-hidden="true"
									>
										<Play size={28} fill="currentColor" strokeWidth={0} />
									</span>
								</button>
							{/if}
						</div>

						<div class="p-4">
							<p class="line-clamp-2 font-medium text-gray-900">{getMediaEventTitle(item)}</p>
							{#if formatMediaDate(item)}
								<p class="mt-2 inline-flex items-center gap-1.5 text-sm text-gray-500">
									<Calendar size={15} aria-hidden="true" />
									{formatMediaDate(item)}
								</p>
							{/if}
						</div>
					</article>
				{/each}
			</div>

			{#if data.totalPages > 1}
				<nav
					class="mt-8 flex flex-wrap items-center justify-center gap-2 sm:mt-12"
					aria-label={$_('rueckblick.pagination.label')}
				>
					{#if data.page > 1}
						<a
							href={buildPageHref(data.page - 1)}
							class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
							aria-label={$_('rueckblick.pagination.previous')}
						>
							<ChevronLeft size={18} aria-hidden="true" />
						</a>
					{/if}

					{#each pageNumbers as pageNum}
						{#if pageNum === '...'}
							<span class="px-3 py-2 text-gray-400">...</span>
						{:else}
							<a
								href={buildPageHref(Number(pageNum))}
								class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors {data.page === pageNum
									? 'bg-blue-600 text-white'
									: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
								aria-current={data.page === pageNum ? 'page' : undefined}
							>
								{pageNum}
							</a>
						{/if}
					{/each}

					{#if data.hasMore}
						<a
							href={buildPageHref(data.page + 1)}
							class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
							aria-label={$_('rueckblick.pagination.next')}
						>
							<ChevronRight size={18} aria-hidden="true" />
						</a>
					{/if}
				</nav>

				<p class="mt-4 text-center text-sm text-gray-500">
					{$_('common.page')} {data.page} / {data.totalPages}
				</p>
			{/if}
		{:else}
			<div class="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm sm:p-12">
				<ImageIcon size={48} class="mx-auto mb-4 text-gray-400" aria-hidden="true" />
				<h2 class="text-xl font-semibold text-gray-900">
					{$_('rueckblick.empty.title')}
				</h2>
				<p class="mx-auto mt-2 max-w-md text-gray-600">
					{$_('rueckblick.empty.description')}
				</p>
			</div>
		{/if}
	</section>
</main>

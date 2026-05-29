<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { ChevronLeft, ChevronRight, Image as ImageIcon, Play, Video } from 'lucide-svelte';
	import type { PublicEventMedia } from '$lib/types/eventMedia';

	let { media } = $props<{ media: PublicEventMedia[] }>();

	let currentIndex = $state(0);
	let visibleCount = $state(1);
	let activeVideoId = $state<number | null>(null);
	let activeVideoElement = $state<HTMLVideoElement | null>(null);
	let failedMediaIds = $state<Set<number>>(new Set());
	let failedThumbnailIds = $state<Set<number>>(new Set());

	const mediaItems = $derived(media ?? []);
	const maxStartIndex = $derived(Math.max(0, mediaItems.length - visibleCount));
	const visibleMedia = $derived(mediaItems.slice(currentIndex, currentIndex + visibleCount));
	const canNavigate = $derived(mediaItems.length > visibleCount);
	const canGoPrevious = $derived(canNavigate && currentIndex > 0);
	const canGoNext = $derived(canNavigate && currentIndex < maxStartIndex);
	const gridClass = $derived(
		visibleMedia.length >= 3
			? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
			: visibleMedia.length === 2
				? 'grid-cols-1 md:grid-cols-2'
				: 'grid-cols-1'
	);

	$effect(() => {
		if (currentIndex > maxStartIndex) {
			currentIndex = maxStartIndex;
		}
	});

	function updateVisibleCount() {
		const width = window.innerWidth;
		if (width >= 1024) {
			visibleCount = 3;
		} else if (width >= 768) {
			visibleCount = 2;
		} else {
			visibleCount = 1;
		}
	}

	function stopActiveVideo() {
		if (activeVideoElement) {
			activeVideoElement.pause();
			activeVideoElement.currentTime = 0;
		}

		activeVideoId = null;
		activeVideoElement = null;
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

	function previousMedia() {
		if (!canGoPrevious) return;
		stopActiveVideo();
		currentIndex = Math.max(0, currentIndex - 1);
	}

	function nextMedia() {
		if (!canGoNext) return;
		stopActiveVideo();
		currentIndex = Math.min(maxStartIndex, currentIndex + 1);
	}

	async function playVideo(item: PublicEventMedia) {
		stopActiveVideo();
		activeVideoId = item.id;
		await tick();

		try {
			await activeVideoElement?.play();
		} catch (error) {
			console.warn('Failed to play homepage media video:', error);
		}
	}

	function getMediaAlt(item: PublicEventMedia): string {
		return item.alt_text?.trim() || '';
	}

	function getVideoLabel(item: PublicEventMedia): string {
		return item.alt_text?.trim() || 'Play video';
	}

	onMount(() => {
		updateVisibleCount();
		window.addEventListener('resize', updateVisibleCount);

		return () => {
			window.removeEventListener('resize', updateVisibleCount);
			stopActiveVideo();
		};
	});
</script>

{#if mediaItems.length > 0}
	<div
		class="relative overflow-hidden rounded-lg border border-blue-200 bg-white p-3 shadow-sm sm:p-4"
	>
		<div class={`grid ${gridClass} gap-3 sm:gap-4`}>
			{#each visibleMedia as item (item.id)}
				{@const mediaFailed = failedMediaIds.has(item.id)}
				{@const thumbnailFailed = failedThumbnailIds.has(item.id)}
				<article
					class="relative min-h-0 overflow-hidden rounded-lg bg-blue-50 shadow-sm"
					aria-label={item.media_type === 'video' ? getVideoLabel(item) : undefined}
				>
					<div class="relative aspect-[4/3] w-full overflow-hidden bg-blue-50">
						{#if mediaFailed}
							<div
								class="flex h-full w-full items-center justify-center bg-blue-50 text-blue-300"
								role="img"
								aria-label={item.media_type === 'video' ? getVideoLabel(item) : getMediaAlt(item)}
							>
								{#if item.media_type === 'video'}
									<Video size={36} aria-hidden="true" />
								{:else}
									<ImageIcon size={36} aria-hidden="true" />
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
								aria-label={getVideoLabel(item)}
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
								<div
									class="flex h-full w-full items-center justify-center bg-blue-50 text-blue-300"
									aria-hidden="true"
								>
									<Video size={36} aria-hidden="true" />
								</div>
							{/if}

							<button
								type="button"
								class="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
								aria-label={getVideoLabel(item)}
								onclick={() => playVideo(item)}
							>
								<span
									class="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-colors hover:bg-blue-700"
									aria-hidden="true"
								>
									<Play size={30} fill="currentColor" strokeWidth={0} />
								</span>
							</button>
						{/if}
					</div>
				</article>
			{/each}
		</div>

		{#if canNavigate}
			<button
				type="button"
				class="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-blue-600 text-white shadow-md transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				aria-label="Previous media"
				disabled={!canGoPrevious}
				onclick={previousMedia}
			>
				<ChevronLeft size={24} aria-hidden="true" />
			</button>

			<button
				type="button"
				class="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-blue-600 text-white shadow-md transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				aria-label="Next media"
				disabled={!canGoNext}
				onclick={nextMedia}
			>
				<ChevronRight size={24} aria-hidden="true" />
			</button>
		{/if}
	</div>
{/if}

<script lang="ts">
	/**
	 * Главная страница приложения
	 *
	 * Отображает:
	 * - Hero секцию с заголовком и призывом к действию
	 * - Список активных предстоящих мероприятий
	 * - Empty state если нет мероприятий
	 * - Секцию с последними отзывами
	 *
	 * Мультиязычная и мобильно адаптированная
	 */

	import { _ } from 'svelte-i18n';
	import EventCard from '$lib/components/events/EventCard.svelte';
	import EventModal from '$lib/components/events/EventModal.svelte';
	import HomepageMediaCollage from '$lib/components/media/HomepageMediaCollage.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import StarRating from '$lib/components/ui/StarRating.svelte';
	import { user as userStore } from '$lib/stores/user';
	import type { EventWithStats } from './+page.server';
	import type { PublicEventMedia } from '$lib/types/eventMedia';
	import type { PublicReview } from '$lib/types/review';

	// Получаем данные из +page.server.ts
	let { data } = $props<{
		data: {
			events: EventWithStats[];
			homepageMedia: PublicEventMedia[];
			latestReviews: PublicReview[];
		};
	}>();

	const events = $derived(data.events ?? []);
	const homepageMedia = $derived(data.homepageMedia ?? []);
	const latestReviews = $derived(data.latestReviews ?? []);

	// Состояние модального окна
	let selectedEvent: EventWithStats | null = $state(null);
	let isModalOpen = $state(false);

	/**
	 * Открывает модальное окно с деталями мероприятия
	 */
	function openEventModal(event: EventWithStats) {
		selectedEvent = event;
		isModalOpen = true;
	}

	/**
	 * Закрывает модальное окно
	 */
	function closeEventModal() {
		isModalOpen = false;
		// Небольшая задержка перед очисткой selectedEvent для плавности анимации закрытия
		setTimeout(() => {
			selectedEvent = null;
		}, 200);
	}

	/**
	 * Определяем есть ли авторизованный пользователь из user store
	 * Синхронизируется с Header и автоматически обновляется при логине/логауте
	 */
	const isAuthenticated = $derived($userStore !== null);

	/**
	 * Форматирует дату отзыва для отображения
	 */
	function formatReviewDate(dateStr: string): string {
		try {
			const date = new Date(dateStr);
			return date.toLocaleDateString(undefined, {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
			});
		} catch {
			return dateStr;
		}
	}

	/**
	 * Получает отображаемое имя автора отзыва
	 */
	function getReviewAuthorName(review: PublicReview): string {
		if (!review.display_name) {
			return $_('reviews.author.anonymous');
		}
		return review.display_name;
	}
</script>

<main class="min-h-screen bg-gray-50">
	<!-- Hero секция -->
	<section class="hero-pattern text-white">
		<div class="hero-overlay">
			<div class="container mx-auto px-4 py-12 sm:py-16 lg:py-20">
				<div class="max-w-3xl mx-auto text-center">
					<h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
						{$_('homepage.hero.title')}
					</h1>
					<p class="text-lg sm:text-xl text-blue-100 mb-8">
						{$_('homepage.hero.subtitle')}
					</p>

					<!-- CTA кнопка если пользователь не авторизован -->
					{#if !isAuthenticated}
						<div class="flex justify-center">
							<Button
								variant="primary"
								type="button"
								size="lg"
								on:click={() => (window.location.href = '/register')}
							>
								{$_('homepage.hero.registerCta')}
							</Button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</section>

	<!-- Секция предстоящих мероприятий -->
	<section class="container mx-auto px-4 py-8 sm:py-12">
		<!-- Заголовок секции -->
		<div class="mb-8 lg:text-center lg:max-w-3xl lg:mx-auto">
			<h2 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
				{$_('homepage.events.title')}
			</h2>
			<p class="text-gray-600">
				{$_('homepage.events.subtitle')}
			</p>
		</div>

		<!-- Список мероприятий или Empty state -->
		{#if events.length > 0}
			<!-- Grid мероприятий (адаптивный: 1 колонка на mobile, 2 на tablet, 3 на desktop) -->
			<div
				class="grid grid-cols-1 md:grid-cols-2 gap-6 lg:[grid-template-columns:repeat(auto-fit,minmax(20rem,22rem))] lg:justify-center lg:max-w-6xl lg:mx-auto"
			>
				{#each events as event (event.id)}
					<EventCard {event} onCardClick={() => openEventModal(event)} />
				{/each}
			</div>
		{:else if homepageMedia.length > 0}
			<HomepageMediaCollage media={homepageMedia} />
		{:else}
			<!-- Empty state -->
			<div
				class="bg-white rounded-lg shadow-sm border border-gray-200 p-8 sm:p-12 text-center"
			>
				<svg
					class="w-16 h-16 sm:w-20 sm:h-20 text-gray-400 mx-auto mb-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
					></path>
				</svg>
				<h3 class="text-xl font-semibold text-gray-900 mb-2">
					{$_('homepage.events.mediaFallback.title')}
				</h3>
				<p class="text-gray-600 mb-6 max-w-md mx-auto">
					{$_('homepage.events.mediaFallback.message')}
				</p>

				<!-- Кнопка обновления -->
				<Button variant="secondary" type="button" on:click={() => window.location.reload()}>
					{$_('homepage.events.empty.refresh')}
				</Button>
			</div>
		{/if}
	</section>

	<!-- Секция отзывов -->
	{#if latestReviews.length > 0}
		<section class="container mx-auto px-4 py-8 sm:py-12">
			<!-- Заголовок секции -->
			<div class="mb-8 lg:text-center lg:max-w-3xl lg:mx-auto">
				<h2 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
					{$_('homepage.reviews.title')}
				</h2>
				<p class="text-gray-600">
					{$_('homepage.reviews.subtitle')}
				</p>
			</div>

			<!-- Список отзывов (mobile-first: вертикальный список, на desktop - горизонтальный скролл/grid) -->
			<div
				class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 xl:[grid-template-columns:repeat(auto-fit,minmax(16rem,18rem))] xl:justify-center xl:max-w-7xl xl:mx-auto"
			>
				{#each latestReviews as review (review.id)}
					<article
						class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-5 flex flex-col"
					>
						<!-- Рейтинг -->
						<div class="mb-3">
							<StarRating
								value={review.rating}
								max={10}
								readonly={true}
								size="sm"
								ariaLabel={$_('reviews.form.rating')}
							/>
						</div>

						<!-- Комментарий (ограничение высоты на mobile) -->
						<p
							class="text-gray-700 text-sm leading-relaxed mb-4 flex-grow line-clamp-4"
						>
							{review.comment}
						</p>

						<!-- Мета-информация -->
						<div class="mt-auto pt-3 border-t border-gray-100">
							<!-- Автор -->
							<p class="text-sm font-medium text-gray-900">
								{getReviewAuthorName(review)}
							</p>

							<!-- Событие и дата -->
							<p
								class="text-xs text-gray-500 mt-1 truncate"
								title={review.event_title_de}
							>
								{review.event_title_de}
							</p>
							<p class="text-xs text-gray-400 mt-0.5">
								{formatReviewDate(review.created_at)}
							</p>
						</div>
					</article>
				{/each}
			</div>

			<!-- Ссылка "Все отзывы" -->
			<div class="mt-8 text-center">
				<a
					href="/reviews"
					class="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
				>
					{$_('homepage.reviews.allLink')}
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5l7 7-7 7"
						></path>
					</svg>
				</a>
			</div>
		</section>
	{/if}
</main>

<!-- Модальное окно с деталями мероприятия -->
{#if selectedEvent}
	<EventModal event={selectedEvent} isOpen={isModalOpen} onClose={closeEventModal} />
{/if}

<style>
	/* Hero-секция с SVG-паттерном и градиентным фоном */
	.hero-pattern {
		/* Базовый цвет на случай, если градиент не применится */
		background-color: #1d4ed8; /* близко к blue-700 */
		/* Сначала паттерн, затем градиент позади него */
		background-image:
			url('/img/hero-pattern.svg'), linear-gradient(to bottom right, #2563eb, #1e3a8a); /* Более тёмный градиент для читаемости */
		background-repeat: repeat, no-repeat;
		background-size:
			100px 100px,
			cover; /* Базовый размер паттерна */
		background-position:
			top left,
			center;
	}

	/* Мягкий overlay для улучшения читаемости текста */
	.hero-overlay {
		/* Высветление верхней левой области для заголовка, затемнение нижней правой для контраста */
		background:
			radial-gradient(ellipse at 30% 20%, rgba(255, 255, 255, 0.12), transparent 50%),
			radial-gradient(circle at 80% 90%, rgba(0, 0, 0, 0.2), transparent 55%);
	}

	/* Мобильные устройства: более крупный паттерн */
	@media (max-width: 640px) {
		.hero-pattern {
			background-size:
				120px 120px,
				cover; /* Крупнее, чтобы не дробился мелкой сеткой */
		}
	}

	/* Десктоп: более тонкий и деликатный паттерн */
	@media (min-width: 1024px) {
		.hero-pattern {
			background-size:
				80px 80px,
				cover; /* Мельче и менее навязчиво */
		}
	}
</style>

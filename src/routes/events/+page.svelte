<script lang="ts">
	/**
	 * Страница списка всех мероприятий (/events)
	 *
	 * Отображает:
	 * - Заголовок страницы
	 * - Список будущих активных мероприятий (upcoming)
	 * - Список прошедших мероприятий (past)
	 * - Empty state если нет мероприятий
	 *
	 * Переиспользует компоненты с главной страницы, но без Hero секции
	 */

	import { _ } from 'svelte-i18n';
	import EventCard from '$lib/components/events/EventCard.svelte';
	import EventModal from '$lib/components/events/EventModal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import type { EventWithStats } from './+page.server';

	// Получаем данные из +page.server.ts
	export let data: { upcomingEvents: EventWithStats[]; pastEvents: EventWithStats[] };

	// Состояние модального окна
	let selectedEvent: EventWithStats | null = null;
	let isModalOpen = false;

	// Проверяем есть ли хоть какие-то мероприятия
	$: hasAnyEvents = data.upcomingEvents.length > 0 || data.pastEvents.length > 0;

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
</script>

<svelte:head>
	<title>{$_('events.page.title')} - Berufsorientierung</title>
	<meta name="description" content={$_('events.page.description')} />
</svelte:head>

<main class="min-h-screen bg-gray-50">
	<!-- Заголовок страницы -->
	<section class="bg-white border-b border-gray-200">
		<div class="container mx-auto px-4 py-8 sm:py-12">
			<div class="max-w-3xl lg:mx-auto lg:text-center">
				<h1 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
					{$_('events.page.heading')}
				</h1>
				<p class="text-lg text-gray-600">
					{$_('events.page.subtitle')}
				</p>
			</div>
		</div>
	</section>

	<!-- Секция мероприятий -->
	<section class="container mx-auto px-4 py-8 sm:py-12">
		<!-- Список мероприятий или Empty state -->
		{#if hasAnyEvents}
			<!-- Будущие мероприятия -->
			{#if data.upcomingEvents.length > 0}
				<div class="mb-12">
					<h2 class="text-2xl font-bold text-gray-900 mb-6 lg:text-center">
						{$_('events.upcomingEvents')}
					</h2>
					<!-- Grid мероприятий (адаптивный: 1 колонка на mobile, 2 на tablet, 3 на desktop) -->
					<div
						class="grid grid-cols-1 md:grid-cols-2 gap-6 lg:[grid-template-columns:repeat(auto-fit,minmax(20rem,22rem))] lg:justify-center lg:max-w-6xl lg:mx-auto"
					>
						{#each data.upcomingEvents as event (event.id)}
							<EventCard {event} onCardClick={() => openEventModal(event)} />
						{/each}
					</div>
				</div>
			{/if}

			<!-- Прошедшие мероприятия -->
			{#if data.pastEvents.length > 0}
				<div>
					<h2 class="text-2xl font-bold text-gray-900 mb-6 lg:text-center">
						{$_('events.pastEvents')}
					</h2>
					<!-- Grid мероприятий (адаптивный: 1 колонка на mobile, 2 на tablet, 3 на desktop) -->
					<div
						class="grid grid-cols-1 md:grid-cols-2 gap-6 lg:[grid-template-columns:repeat(auto-fit,minmax(20rem,22rem))] lg:justify-center lg:max-w-6xl lg:mx-auto"
					>
						{#each data.pastEvents as event (event.id)}
							<EventCard {event} onCardClick={() => openEventModal(event)} />
						{/each}
					</div>
				</div>
			{/if}
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
					{$_('homepage.events.empty.title')}
				</h3>
				<p class="text-gray-600 mb-6 max-w-md mx-auto">
					{$_('homepage.events.empty.message')}
				</p>

				<!-- Кнопка обновления -->
				<Button variant="secondary" type="button" on:click={() => window.location.reload()}>
					{$_('homepage.events.empty.refresh')}
				</Button>
			</div>
		{/if}
	</section>
</main>

<!-- Модальное окно с деталями мероприятия -->
{#if selectedEvent}
	<EventModal event={selectedEvent} isOpen={isModalOpen} onClose={closeEventModal} />
{/if}

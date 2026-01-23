<script lang="ts">
	/**
	 * EventCard - карточка мероприятия для главной страницы
	 *
	 * Отображает краткую информацию о мероприятии:
	 * - Название на текущем языке (fallback на немецкий)
	 * - Дата и время
	 * - Прогресс-бар занятости мест
	 * - Статус регистрации
	 * - Кнопки действия
	 *
	 * Адаптивная, с hover эффектами и поддержкой accessibility
	 */

	import { _ } from 'svelte-i18n';
	import { currentLanguage } from '$lib/stores/language';
	import type { EventWithStats } from '../../../routes/+page.server';
	import Button from '../ui/Button.svelte';

	// Props
	export let event: EventWithStats;
	export let onCardClick: () => void = () => {};

	// Получение переведённого названия с fallback на немецкий
	$: title = getTranslatedField('title');

	// Получение переведённого места с fallback на немецкий
	$: location = getTranslatedField('location');

	// Процент заполненности мест (безлимитные события = 0%)
	$: fillPercentage = event.max_participants
		? (event.registeredCount / event.max_participants) * 100
		: 0;

	// Определение прошедшего мероприятия (end_date <= now или date <= now)
	$: isPastEvent = (() => {
		const now = new Date();
		const eventEndDate = event.end_date ? new Date(event.end_date) : new Date(event.date);
		const endMs = eventEndDate.getTime();
		// Если дата невалидна - fail-closed (лучше показать "Прошедшее" и скрыть CTA)
		if (Number.isNaN(endMs)) {
			return true;
		}
		return eventEndDate <= now;
	})();

	// Определение статуса регистрации
	$: registrationStatus = getRegistrationStatus();

	// Определение цвета прогресс-бара
	$: progressBarColor = getProgressBarColor();

	// Определение можно ли записаться
	$: canRegister =
		!isPastEvent && !event.isDeadlinePassed && event.spotsLeft > 0 && !event.isUserRegistered;

	/**
	 * Получает переведённое поле с fallback на немецкий
	 */
	function getTranslatedField(fieldName: 'title' | 'location'): string {
		const lang = $currentLanguage;
		const fieldKey = `${fieldName}_${lang}` as keyof typeof event;
		const fallbackKey = `${fieldName}_de` as keyof typeof event;

		const translated = event[fieldKey];
		const fallback = event[fallbackKey];

		// Возвращаем переведённое значение если оно не пустое, иначе fallback
		if (translated && typeof translated === 'string' && translated.trim()) {
			return translated;
		}

		return (fallback as string) || '';
	}

	/**
	 * Определяет текстовый статус регистрации
	 */
	function getRegistrationStatus(): string {
		if (event.isUserRegistered) {
			return $_('events.status.registered');
		}
		if (isPastEvent) {
			return $_('events.status.past');
		}
		if (event.isDeadlinePassed) {
			return $_('events.status.deadlinePassed');
		}
		if (event.spotsLeft === 0) {
			return $_('events.status.full');
		}
		return $_('events.status.open');
	}

	/**
	 * Определяет цвет прогресс-бара в зависимости от заполненности
	 */
	function getProgressBarColor(): string {
		if (fillPercentage >= 100) return 'bg-red-500';
		if (fillPercentage >= 80) return 'bg-orange-500';
		if (fillPercentage >= 50) return 'bg-yellow-500';
		return 'bg-green-500';
	}

	/**
	 * Форматирует дату для отображения
	 */
	function formatDate(dateString: string): string {
		try {
			const date = new Date(dateString);
			const lang = $currentLanguage;

			return date.toLocaleDateString(lang, {
				weekday: 'short',
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
			});
		} catch (error) {
			console.error('Error formatting date:', error);
			return dateString;
		}
	}

	/**
	 * Обработчик клика по оверлей-кнопке (открывает модал)
	 */
	function handleOverlayClick() {
		onCardClick();
	}

	/**
	 * Обработчик клика по кнопке регистрации
	 */
	function handleRegisterClick() {
		window.location.href = `/events/${event.id}/register`;
	}

	/**
	 * Обработчик клика по кнопке входа
	 */
	function handleLoginClick() {
		window.location.href = `/login?redirectTo=${encodeURIComponent(`/events/${event.id}/register`)}`;
	}

	/**
	 * Обработчик нажатия Enter на карточке (для keyboard accessibility)
	 */
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onCardClick();
		}
	}
</script>

<!-- 
	Карточка мероприятия
	- Клик по оверлей-кнопке открывает модал с деталями
	- Адаптивная: полная карточка на desktop, компактная на mobile
	- Accessibility: оверлей-кнопка для keyboard navigation
-->
<article
	class="relative bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden"
	aria-label={title}
>
	<!-- Невидимая кнопка-оверлей для клавиатурной доступности -->
	<button
		type="button"
		class="absolute inset-0 w-full h-full z-0 cursor-pointer"
		aria-label="{title} - {$_('events.viewDetails')}"
		on:click={handleOverlayClick}
		on:keydown={handleKeyDown}
	>
		<span class="sr-only">{$_('events.viewDetails')}</span>
	</button>

	<!-- Постер мероприятия (если есть) -->
	{#if event.poster_url}
		<div
			class="relative z-10 w-full aspect-[4/3] overflow-hidden bg-gray-50 border-b border-gray-200 pointer-events-none"
		>
			<img
				src={event.poster_url}
				alt={title}
				class="w-full h-full object-contain"
				loading="lazy"
				decoding="async"
			/>
		</div>
	{/if}

	<!-- Контент карточки (все интерактивные элементы должны иметь z-index выше оверлея) -->
	<div class="relative z-10 p-4 sm:p-6 pointer-events-none">
		<h3 class="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
			{title}
		</h3>

		<!-- Дата и время -->
		<div class="flex items-center text-sm text-gray-600 mb-2">
			<svg
				class="w-4 h-4 mr-2"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
				></path>
			</svg>
			<time datetime={event.date}>
				{formatDate(event.date)}
			</time>
		</div>

		<!-- Место проведения -->
		{#if location}
			<div class="flex items-center text-sm text-gray-600 mb-4">
				<svg
					class="w-4 h-4 mr-2 flex-shrink-0"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
					></path>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
					></path>
				</svg>
				<span class="line-clamp-1">{location}</span>
			</div>
		{/if}

		<!-- Прогресс-бар мест -->
		<div class="mb-4">
			<div class="flex justify-between items-center text-sm text-gray-700 mb-2">
				<span>{$_('events.participants')}</span>
				<span class="font-medium">
					{event.registeredCount} / {event.max_participants}
				</span>
			</div>

			<!-- Прогресс-бар -->
			<div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
				<div
					class="{progressBarColor} h-full transition-all duration-500 rounded-full"
					style="width: {Math.min(fillPercentage, 100)}%"
					role="progressbar"
					aria-valuenow={event.registeredCount}
					aria-valuemin="0"
					aria-valuemax={event.max_participants}
					aria-label="{$_('events.spotsLeft')}: {event.spotsLeft}"
				></div>
			</div>

			<!-- Оставшиеся места -->
			<p class="text-xs text-gray-500 mt-1">
				{#if event.spotsLeft > 0}
					{$_('events.spotsLeft')}: <span class="font-medium">{event.spotsLeft}</span>
				{:else}
					{$_('events.status.full')}
				{/if}
			</p>
		</div>

		<!-- Статус регистрации -->
		<div class="mb-4">
			{#if event.isUserRegistered}
				<span
					class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"
				>
					<svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
							clip-rule="evenodd"
						></path>
					</svg>
					{registrationStatus}
				</span>
			{:else if isPastEvent}
				<span
					class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800"
				>
					{registrationStatus}
				</span>
			{:else if event.isDeadlinePassed}
				<span
					class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800"
				>
					{registrationStatus}
				</span>
			{:else if event.spotsLeft === 0}
				<span
					class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800"
				>
					{registrationStatus}
				</span>
			{:else}
				<span
					class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
				>
					{registrationStatus}
				</span>
			{/if}
		</div>

		<!-- Кнопка действия -->
		<div class="flex gap-2 pointer-events-auto">
			{#if event.isUserRegistered}
				<!-- Пользователь уже записан - показываем badge выше, кнопка "Подробнее" -->
				<Button
					variant="secondary"
					type="button"
					fullWidth
					on:click={(e) => {
						e.stopPropagation();
						onCardClick();
					}}
				>
					{$_('events.viewDetails')}
				</Button>
			{:else if !event.isUserRegistered && typeof event.isUserRegistered === 'boolean'}
				<!-- Пользователь авторизован, но не записан -->
				{#if canRegister}
					<Button
						variant="primary"
						type="button"
						fullWidth
						on:click={(e) => {
							e.stopPropagation();
							handleRegisterClick();
						}}
					>
						{$_('events.register')}
					</Button>
				{:else}
					<Button variant="secondary" type="button" fullWidth disabled>
						{#if isPastEvent}
							{$_('events.status.past')}
						{:else if event.isDeadlinePassed}
							{$_('events.status.deadlinePassed')}
						{:else}
							{$_('events.status.full')}
						{/if}
					</Button>
				{/if}
			{:else}
				<!-- Пользователь не авторизован -->
				{#if canRegister}
					<Button
						variant="primary"
						type="button"
						fullWidth
						on:click={(e) => {
							e.stopPropagation();
							handleLoginClick();
						}}
					>
						{$_('events.loginToRegister')}
					</Button>
				{:else}
					<Button variant="secondary" type="button" fullWidth disabled>
						{#if isPastEvent}
							{$_('events.status.past')}
						{:else if event.isDeadlinePassed}
							{$_('events.status.deadlinePassed')}
						{:else}
							{$_('events.status.full')}
						{/if}
					</Button>
				{/if}
			{/if}
		</div>
	</div>
</article>

<style>
	/* Line clamp для обрезки длинного текста */
	.line-clamp-1 {
		display: -webkit-box;
		-webkit-line-clamp: 1;
		line-clamp: 1; /* Стандартное свойство для совместимости */
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* Улучшенная анимация при hover */
	article:hover {
		transform: translateY(-2px);
	}

	/* Фокус для accessibility - применяется к оверлей-кнопке */
	article button:focus {
		outline: 2px solid #3b82f6;
		outline-offset: -2px;
	}

	/* Transition для плавности */
	article {
		transition:
			box-shadow 0.3s ease,
			transform 0.2s ease;
	}
</style>
